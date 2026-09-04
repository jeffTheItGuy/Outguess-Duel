// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OutguessDuel is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum GameState { WAITING_FOR_STAKES, COMMIT_PHASE, REVEAL_PHASE }

    struct Player {
        bool staked;
        bool committed;
        bool revealed;
        bytes32 commitment;
        uint256 secret;
        uint256 guess;
    }

    IERC20 public immutable token;
    uint256 public immutable stakeAmount;
    uint256 public immutable commitDuration;
    uint256 public immutable revealDuration;
    address public immutable treasury;

    GameState public state;
    address[2] public participants;
    uint8 public participantCount;
    
    uint256 public commitEndTime;
    uint256 public revealEndTime;

    mapping(address => Player) public players;

    event Staked(address indexed player);
    event Committed(address indexed player, bytes32 commitment);
    event Revealed(address indexed player, uint256 secret, uint256 guess);
    event GameResolved(address indexed winner1, address indexed winner2, uint256 payout1, uint256 payout2);
    event GameForfeited(address indexed winner);

    constructor(
        IERC20 _token,
        uint256 _stakeAmount,
        uint256 _commitDuration,
        uint256 _revealDuration,
        address _treasury
    ) {
        require(address(_token) != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        token = _token;
        stakeAmount = _stakeAmount;
        commitDuration = _commitDuration;
        revealDuration = _revealDuration;
        treasury = _treasury;
        state = GameState.WAITING_FOR_STAKES;
    }

    function stake() external nonReentrant {
        require(state == GameState.WAITING_FOR_STAKES, "Not staking phase");
        require(!players[msg.sender].staked, "Already staked");
        
        token.safeTransferFrom(msg.sender, address(this), stakeAmount);
        players[msg.sender].staked = true;
        participants[participantCount] = msg.sender;
        participantCount++;
        
        emit Staked(msg.sender);

        if (participantCount == 2) {
            state = GameState.COMMIT_PHASE;
            commitEndTime = block.timestamp + commitDuration;
        }
    }

    // Allows a player to get their tokens back if the second player never joins
    function withdrawUnmatchedStake() external nonReentrant {
        require(state == GameState.WAITING_FOR_STAKES, "Game already started");
        require(players[msg.sender].staked, "No stake to withdraw");
        
        players[msg.sender].staked = false;
        token.safeTransfer(msg.sender, stakeAmount);
        
        // Clean up participant arrays
        if (participantCount == 2) {
            if (participants[0] == msg.sender) {
                participants[0] = participants[1];
                participants[1] = address(0);
            } else if (participants[1] == msg.sender) {
                participants[1] = address(0);
            }
            participantCount--;
        } else if (participantCount == 1 && participants[0] == msg.sender) {
            participants[0] = address(0);
            participantCount--;
        }
    }

    function _transitionState() internal {
        if (state == GameState.COMMIT_PHASE && block.timestamp > commitEndTime) {
            state = GameState.REVEAL_PHASE;
            revealEndTime = block.timestamp + revealDuration;
        }
    }

    function commit(bytes32 commitment) external {
        _transitionState();
        require(state == GameState.COMMIT_PHASE, "Not commit phase");
        require(block.timestamp <= commitEndTime, "Commit phase ended");
        require(players[msg.sender].staked, "Must stake first");
        require(!players[msg.sender].committed, "Already committed");
        
        players[msg.sender].commitment = commitment;
        players[msg.sender].committed = true;
        
        emit Committed(msg.sender, commitment);
    }

    function reveal(uint256 secret, uint256 guess, bytes32 salt) external nonReentrant {
        _transitionState();
        require(state == GameState.REVEAL_PHASE, "Not reveal phase");
        require(block.timestamp <= revealEndTime, "Reveal phase ended");
        
        Player storage p = players[msg.sender];
        require(p.staked, "Must stake first");
        require(p.committed, "Must commit first");
        require(!p.revealed, "Already revealed");
        
        bytes32 hash = keccak256(abi.encodePacked(secret, guess, salt));
        require(hash == p.commitment, "Invalid reveal");
        
        p.secret = secret;
        p.guess = guess;
        p.revealed = true;
        
        emit Revealed(msg.sender, secret, guess);
        
        // If both revealed, resolve immediately
        if (players[participants[0]].revealed && players[participants[1]].revealed) {
            _resolveGame();
        }
    }

    function resolveGame() external nonReentrant {
        _transitionState(); 
        require(state == GameState.REVEAL_PHASE, "Game not in reveal phase");
        require(
            block.timestamp > revealEndTime || 
            (players[participants[0]].revealed && players[participants[1]].revealed),
            "Reveal phase still active"
        );
        _resolveGame();
    }

    function _resolveGame() internal {
        address p1 = participants[0];
        address p2 = participants[1];
        Player memory pl1 = players[p1];
        Player memory pl2 = players[p2];
        
        uint256 pot = token.balanceOf(address(this));
        uint256 payout1 = 0;
        uint256 payout2 = 0;

        if (!pl1.revealed && !pl2.revealed) {
            // Neither revealed: both forfeit to treasury/burn
            token.safeTransfer(treasury, pot);
            emit GameForfeited(treasury);
        } else if (pl1.revealed && !pl2.revealed) {
            // p1 wins by default
            payout1 = pot;
            token.safeTransfer(p1, payout1);
            emit GameForfeited(p1);
        } else if (!pl1.revealed && pl2.revealed) {
            // p2 wins by default
            payout2 = pot;
            token.safeTransfer(p2, payout2);
            emit GameForfeited(p2);
        } else {
            // Both revealed: calculate distance (absolute difference)
            uint256 dist1 = pl1.guess > pl2.secret ? pl1.guess - pl2.secret : pl2.secret - pl1.guess;
            uint256 dist2 = pl2.guess > pl1.secret ? pl2.guess - pl1.secret : pl1.secret - pl2.guess;
            
            if (dist1 < dist2) {
                payout1 = pot;
                token.safeTransfer(p1, payout1);
            } else if (dist2 < dist1) {
                payout2 = pot;
                token.safeTransfer(p2, payout2);
            } else {
                // Exact tie: 50/50 split
                payout1 = pot / 2;
                payout2 = pot - payout1;
                token.safeTransfer(p1, payout1);
                token.safeTransfer(p2, payout2);
            }
        }
        
        emit GameResolved(p1, p2, payout1, payout2);
        
        // Reset state for the next game
        delete players[p1];
        delete players[p2];
        participants[0] = address(0);
        participants[1] = address(0);
        participantCount = 0;
        state = GameState.WAITING_FOR_STAKES;
        commitEndTime = 0;
        revealEndTime = 0;
    }
}