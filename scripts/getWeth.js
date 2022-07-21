const { getNamedAccounts, ethers, network } = require('hardhat')
const { networkConfig } = require('../helper-hardhat-config')

async function getWeth() {
  const { deployer } = await getNamedAccounts()
  // I need the weth contract: ABI -> , Address -> ,
  const wethAddress = networkConfig[network.config.chainId]['wethAddress']
  const amount = networkConfig[network.config.chainId]['amount']

  const iWeth = await ethers.getContractAt('IWeth', wethAddress, deployer)

  //   Make deposit to weth
  const tx = await iWeth.deposit({
    value: amount,
  })
  await tx.wait(1)

  //   Get balance
  const wethBalance = await iWeth.balanceOf(deployer)
  console.log(`You now have ${wethBalance.toString()} WETH`)
}

module.exports = {
  getWeth,
}
