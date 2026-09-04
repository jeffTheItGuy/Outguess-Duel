// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Outguess Gold", "OG") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    // Helpful for testing frontend interactions without dealing with faucets
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}