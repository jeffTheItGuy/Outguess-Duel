// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OutguessDuel {
    enum Phase {
        Idle,
        Commit,
        Reveal,
        Finished
    }

    struct Player {
        bool isPlayer;
        bool hasStaked;
        bool hasCommitted;
        bool hasRevealed;
        bytes32 commitHash;
        uint256 secret;
        uint256 guess;
    }

    Phase public gamePhase;

    uint256 public pot;
    uint256 public requiredStake;

    uint256 public commitWindowEnd;
    uint256 public revealWindowEnd;

    address public player1;
    address public player2;
    address public winner;

    mapping(address => Player) public players;

    uint256 public commitWindowSeconds = 300;
    uint256 public revealWindowSeconds = 300;

    function stake() external payable {
        if (gamePhase == Phase.Finished) {
            _reset();
        }

        require(gamePhase == Phase.Idle, "Game is not idle");
        require(msg.value > 0, "Must send ETH");

        if (requiredStake == 0) {
            requiredStake = msg.value;
        }

        require(
            msg.value == requiredStake,
            "Stake amount does not match current duel"
        );

        Player storage sender = players[msg.sender];
        require(!sender.hasStaked, "Already staked");

        if (player1 == address(0)) {
            player1 = msg.sender;
        } else if (player2 == address(0) && msg.sender != player1) {
            player2 = msg.sender;
        } else {
            revert("Match is full");
        }

        sender.isPlayer = true;
        sender.hasStaked = true;

        pot += msg.value;

        if (player1 != address(0) && player2 != address(0)) {
            gamePhase = Phase.Commit;
            commitWindowEnd = block.timestamp + commitWindowSeconds;
        }
    }

    function commit(bytes32 hash) external {
        require(gamePhase == Phase.Commit, "Not in commit phase");
        require(_isPlayer(msg.sender), "Not a player");
        require(block.timestamp <= commitWindowEnd, "Commit window over");

        Player storage p = players[msg.sender];

        require(p.hasStaked, "Not staked");
        require(!p.hasCommitted, "Already committed");

        p.commitHash = hash;
        p.hasCommitted = true;

        if (
            players[player1].hasCommitted &&
            players[player2].hasCommitted
        ) {
            gamePhase = Phase.Reveal;
            revealWindowEnd = block.timestamp + revealWindowSeconds;
        }
    }

    function reveal(
        uint256 secret,
        uint256 guess,
        uint256 salt
    ) external {
        require(gamePhase == Phase.Reveal, "Not in reveal phase");
        require(_isPlayer(msg.sender), "Not a player");
        require(block.timestamp <= revealWindowEnd, "Reveal window over");

        Player storage p = players[msg.sender];

        require(p.hasCommitted, "Not committed");
        require(!p.hasRevealed, "Already revealed");

        bytes32 expectedHash = keccak256(
            abi.encodePacked(secret, guess, salt)
        );

        require(
            expectedHash == p.commitHash,
            "Reveal does not match commit"
        );

        p.secret = secret;
        p.guess = guess;
        p.hasRevealed = true;

        if (
            players[player1].hasRevealed &&
            players[player2].hasRevealed
        ) {
            _finish();
        }
    }

    function claimTimeout() external {
        if (gamePhase == Phase.Commit) {
            require(
                block.timestamp > commitWindowEnd,
                "Commit window not over"
            );

            bool p1Committed = players[player1].hasCommitted;
            bool p2Committed = players[player2].hasCommitted;

            if (p1Committed && p2Committed) {
                gamePhase = Phase.Reveal;
                revealWindowEnd = block.timestamp + revealWindowSeconds;
                return;
            }

            if (p1Committed && !p2Committed) {
                require(msg.sender == player1, "Only committed player can claim");
                _finishWithWinner(player1);
                return;
            }

            if (!p1Committed && p2Committed) {
                require(msg.sender == player2, "Only committed player can claim");
                _finishWithWinner(player2);
                return;
            }

            require(
                msg.sender == player1 || msg.sender == player2,
                "Not a player"
            );

            _refundBothAndReset();
            return;
        }

        if (gamePhase == Phase.Reveal) {
            require(
                block.timestamp > revealWindowEnd,
                "Reveal window not over"
            );

            bool p1Revealed = players[player1].hasRevealed;
            bool p2Revealed = players[player2].hasRevealed;

            if (p1Revealed && p2Revealed) {
                _finish();
                return;
            }

            if (p1Revealed && !p2Revealed) {
                require(msg.sender == player1, "Only revealed player can claim");
                _finishWithWinner(player1);
                return;
            }

            if (!p1Revealed && p2Revealed) {
                require(msg.sender == player2, "Only revealed player can claim");
                _finishWithWinner(player2);
                return;
            }

            require(
                msg.sender == player1 || msg.sender == player2,
                "Not a player"
            );

            _refundBothAndReset();
            return;
        }

        revert("No timeout to claim");
    }

    function _finish() internal {
        gamePhase = Phase.Finished;

        uint256 payout = pot;

        pot = 0;
        requiredStake = 0;
        commitWindowEnd = 0;
        revealWindowEnd = 0;

        Player storage p1 = players[player1];
        Player storage p2 = players[player2];

        bool p1Correct = p1.guess == p2.secret;
        bool p2Correct = p2.guess == p1.secret;

        if (p1Correct && !p2Correct) {
            winner = player1;
            _pay(player1, payout);
        } else if (p2Correct && !p1Correct) {
            winner = player2;
            _pay(player2, payout);
        } else {
            winner = address(0);

            uint256 half = payout / 2;

            if (half > 0) {
                _pay(player1, half);
                _pay(player2, payout - half);
            }
        }
    }

    function _finishWithWinner(address w) internal {
        gamePhase = Phase.Finished;
        winner = w;

        uint256 payout = pot;

        pot = 0;
        requiredStake = 0;
        commitWindowEnd = 0;
        revealWindowEnd = 0;

        if (payout > 0) {
            _pay(w, payout);
        }
    }

    function _refundBothAndReset() internal {
        uint256 payout = pot;

        pot = 0;

        uint256 refund1;
        uint256 refund2;

        if (payout >= requiredStake * 2) {
            refund1 = requiredStake;
            refund2 = requiredStake;
        } else {
            refund1 = payout / 2;
            refund2 = payout - refund1;
        }

        if (refund1 > 0) {
            _pay(player1, refund1);
        }

        if (refund2 > 0) {
            _pay(player2, refund2);
        }

        _reset();
    }

    function _reset() internal {
        if (player1 != address(0)) {
            delete players[player1];
        }

        if (player2 != address(0)) {
            delete players[player2];
        }

        gamePhase = Phase.Idle;

        pot = 0;
        requiredStake = 0;

        commitWindowEnd = 0;
        revealWindowEnd = 0;

        player1 = address(0);
        player2 = address(0);
        winner = address(0);
    }

    function _pay(address to, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function _isPlayer(address addr) internal view returns (bool) {
        return players[addr].isPlayer;
    }
}