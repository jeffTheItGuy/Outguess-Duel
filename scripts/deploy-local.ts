import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const OutguessDuel = await ethers.getContractFactory("OutguessDuel");
  
  // Note: This deploys with NO constructor arguments. 
  // This ONLY works if you replaced your contract with the Native ETH version!
  const duel = await OutguessDuel.deploy();
  await duel.waitForDeployment();
  
  const contractAddress = await duel.getAddress();
  console.log("OutguessDuel deployed to:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});