import { expect } from "chai";
import { ethers } from "hardhat";

describe("OutguessDuel", function () {
  it("runs a full game and pays the closer guesser", async function () {
    const [deployer, player1, player2, treasury] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    const token = await MockToken.deploy();
    await token.waitForDeployment();

    const tokenAddress = await token.getAddress();

    // Deploy game
    const stakeAmount = ethers.parseUnits("100", 18);
    const commitDuration = 60; // 60 seconds
    const revealDuration = 60; // 60 seconds

    const OutguessDuel = await ethers.getContractFactory("OutguessDuel");
    const game = await OutguessDuel.deploy(
      tokenAddress,
      stakeAmount,
      commitDuration,
      revealDuration,
      treasury.address
    );
    await game.waitForDeployment();

    const gameAddress = await game.getAddress();

    // Give players tokens and approve the game contract
    await token.mint(player1.address, stakeAmount);
    await token.mint(player2.address, stakeAmount);

    await token.connect(player1).approve(gameAddress, stakeAmount);
    await token.connect(player2).approve(gameAddress, stakeAmount);

    // Both players stake
    await game.connect(player1).stake();
    await game.connect(player2).stake();

    // Player 1 secret is 10
    // Player 1 guesses player 2 secret is 40
    const secret1 = 10n;
    const guess1 = 40n;
    const salt1 = ethers.hexlify(ethers.randomBytes(32));

    // Player 2 secret is 42
    // Player 2 guesses player 1 secret is 20
    const secret2 = 42n;
    const guess2 = 20n;
    const salt2 = ethers.hexlify(ethers.randomBytes(32));

    // Create commitments (keccak256 of secret, guess, salt)
    const commit1 = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "uint256", "bytes32"],
        [secret1, guess1, salt1]
      )
    );

    const commit2 = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "uint256", "bytes32"],
        [secret2, guess2, salt2]
      )
    );

    // Both players commit
    await game.connect(player1).commit(commit1);
    await game.connect(player2).commit(commit2);

    // Move time past the commit phase
    await ethers.provider.send("evm_increaseTime", [commitDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    // Both players reveal
    await game.connect(player1).reveal(secret1, guess1, salt1);
    await game.connect(player2).reveal(secret2, guess2, salt2);

    // Player 1 guessed 40, player 2 secret was 42, distance = 2
    // Player 2 guessed 20, player 1 secret was 10, distance = 10
    // Player 1 should win the full 200 token pot
    expect(await token.balanceOf(player1.address)).to.equal(stakeAmount * 2n);
    expect(await token.balanceOf(player2.address)).to.equal(0n);
    expect(await token.balanceOf(gameAddress)).to.equal(0n);
  });
});