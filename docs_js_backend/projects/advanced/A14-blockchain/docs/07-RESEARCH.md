# A14 Blockchain Backend: Research & Citations

## Academic Papers

1. **Nakamoto, S. (2008).** "Bitcoin: A Peer-to-Peer Electronic Cash System."
   - https://bitcoin.org/bitcoin.pdf
   - The foundational paper on blockchain, proof of work, and decentralized consensus.

2. **Buterin, V. (2014).** "Ethereum: A Next-Generation Smart Contract and Decentralized Application Platform."
   - https://ethereum.org/content/whitepaper/whitepaper-pdf/Ethereum_Whitepaper_-_Buterin_2014.pdf
   - Introduces the account model, smart contracts, and the EVM.

3. **Gervais, A., et al. (2016).** "On the Security and Performance of Proof of Work Blockchains." *ACM CCS 2016*.
   - Analyzes the trade-offs between security (confirmation depth) and performance in PoW systems.

4. **Kalodner, H., et al. (2018).** "Arbitrum: Scalable, private smart contracts." *USENIX Security 2018*.
   - Introduces optimistic rollups, a key L2 scaling solution.

## Industry Standards

5. **EIP-155: Simple replay attack protection**
   - https://eips.ethereum.org/EIPS/eip-155
   - Defines chain ID inclusion in transaction signatures to prevent cross-chain replay.

6. **EIP-1559: Fee market change**
   - https://eips.ethereum.org/EIPS/eip-1559
   - Introduces base fee burning and priority fees. Replaced the auction-based gas price model.

7. **ERC-4337: Account Abstraction via Entry Point Contract**
   - https://eips.ethereum.org/EIPS/eip-4337
   - Enables smart contract wallets without consensus-layer changes.

## Breach Case Studies

8. **The DAO Hack (2016)**
   - https://www.coindesk.com/markets/2016/06/25/understanding-the-dao-attack/
   - $60M stolen via recursive call exploit. Led to Ethereum hard fork.

9. **Parity Multisig Hack (2017)**
   - https://www.coindesk.com/markets/2017/07/19/30-million-ether-reported-stolen-parity-wallet-breach/
   - $30M stolen due to initcode vulnerability.

10. **Ronin Bridge Hack (2022)**
    - https://www.coindesk.com/business/2022/03/29/axie-infinitys-ronin-network-suffers-625m-exploit/
    - $625M stolen from Axie Infinity's bridge.

11. **Bitcoin Gold 51% Attack (2018)**
    - https://www.coindesk.com/markets/2018/05/24/bitcoin-gold-hit-by-double-spend-attack-exchanges-lose-millions/
    - $18M double-spend via rented hash power.

## Books

12. **Antonopoulos, A. M. (2017).** *Mastering Bitcoin* (2nd ed.). O'Reilly.
    - Deep technical coverage of Bitcoin transaction structure, scripting, and validation.

13. **Antonopoulos, A. M., & Wood, G. (2018).** *Mastering Ethereum*. O'Reilly.
    - Covers EVM, Solidity, gas mechanics, and security.

14. **Narayanan, A., et al. (2016).** *Bitcoin and Cryptocurrency Technologies*. Princeton University Press.
    - Academic textbook on the theory and practice of cryptocurrencies.

## Development Tools

15. **Viem (TypeScript Ethereum Client)**
    - https://viem.sh/
    - Modern, type-safe alternative to Ethers.js.

16. **Foundry (Ethereum Development Toolkit)**
    - https://book.getfoundry.sh/
    - Fast Rust-based testing and deployment framework.

17. **Hardhat**
    - https://hardhat.org/
    - JavaScript-based development environment for Ethereum.

## Security Resources

18. **Smart Contract Weakness Classification (SWC)**
    - https://swcregistry.io/
    - Common vulnerability patterns in smart contracts.

19. **OpenZeppelin Contracts**
    - https://docs.openzeppelin.com/contracts/
    - Audited, reusable smart contract components.

20. **Trail of Bits Blockchain Security Blog**
    - https://blog.trailofbits.com/category/blockchain/
    - High-quality security research and audits.
