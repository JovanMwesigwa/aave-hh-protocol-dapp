const { getNamedAccounts, ethers, network } = require('hardhat')
const { getWeth } = require('./getWeth')
const { networkConfig } = require('../helper-hardhat-config')

async function main() {
  const { deployer } = await getNamedAccounts()
  const iWethAddress = networkConfig[network.config.chainId]['wethAddress']
  const amount = networkConfig[network.config.chainId]['amount']

  // First deposit some weth
  await getWeth()
  //   Now we need to deposit the WETH
  // First we need the Lending pool contract, but in order to get it, we need to get it from the lending pool addresses provider
  const lendingPoolAddress = await getLendingPoolAddress(deployer)

  //   Now we need to extract the LendingPoolContract using the ABI -> , address -> lendingPoolAddress
  const lendingPool = await ethers.getContractAt(
    'ILendingPool',
    lendingPoolAddress,
    deployer
  )
  //   Now that we have the lending pool contract, we can call .deposit() and deposit the WETH that we have. BUT:
  // Before we need to call the approve ERC20
  await approveERC20(iWethAddress, lendingPool.address, amount, deployer)

  //   After approve, we need to call the deposit on the aave lending Pool contract
  await deposit(lendingPool, iWethAddress, amount, deployer)

  //   Now that we've finished depositing our weth to aave lending pool, we can start borrowing.
  // Before we borrow, lets first start with checking to see our aave account info in the lending pool contract
  let { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await getUserData(lendingPool, deployer)

  // Lets get tha DAI token amount
  // Get the DAI to ETH exchange
  const daiToEthPrice = await getDaiToEthExchange()
  const amountOfDaiToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiToEthPrice.toNumber())
  console.log(`You can borrow ${amountOfDaiToBorrow.toString()} DAI`)

  //   Converting amount of DAI to borrow  to ETH
  const amountOfDaiToBorrowInETH = await ethers.utils.parseEther(
    amountOfDaiToBorrow.toString()
  )
  // Time to Borrow
  await borrowAsset(lendingPool, amountOfDaiToBorrowInETH, deployer)
  console.log('----------------------------------------------------------')

  //   Check account info
  await getUserData(lendingPool, deployer)
}

async function getLendingPoolAddress(account) {
  const iLendingPoolAddressesProvider =
    networkConfig[network.config.chainId]['iLendingPoolAddressesProvider']

  const lendingPoolAddressesProvider = await ethers.getContractAt(
    'ILendingPoolAddressesProvider',
    iLendingPoolAddressesProvider,
    account
  )

  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
  console.log(`Lending Pool address is ${lendingPoolAddress}`)
  return lendingPoolAddress
}

async function approveERC20(erc20Address, spenderAddress, amount, signer) {
  const erc20Token = await ethers.getContractAt('IERC20', erc20Address, signer)
  txResponse = await erc20Token.approve(spenderAddress, amount)
  await txResponse.wait(1)
  console.log('Approved!')
}

async function deposit(lendingPool, wethAddress, AMOUNT, account) {
  const depositTx = await lendingPool.deposit(wethAddress, AMOUNT, account, 0)
  await depositTx.wait(1)
  console.log(
    `Hooray! You've successfully deposited your Weth / collateral ETH to Aave lending Pool`
  )
}

async function getUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account)
  console.log(
    `You have a total collateral of ${totalCollateralETH.toString()} ETH`
  )
  console.log(`You have a total depth of ${totalDebtETH} ETH`)
  console.log(`You can borrow ${availableBorrowsETH} ETH`)
  return {
    totalCollateralETH,
    totalDebtETH,
    availableBorrowsETH,
  }
}

async function getDaiToEthExchange() {
  const daiToEthAddress =
    networkConfig[network.config.chainId]['daiToEthAddress']
  const aggregator = await ethers.getContractAt(
    'AggregatorV3Interface',
    daiToEthAddress
  )
  const price = (await aggregator.latestRoundData())[1]
  console.log(`DAI / ETH exchange price is ${price.toString()}`)
  return price
}

async function borrowAsset(lendingPool, AMOUNT, account) {
  const daiAddress = networkConfig[network.config.chainId]['daiAddress']
  const borrowTx = await lendingPool.borrow(daiAddress, AMOUNT, 1, 0, account)
  await borrowTx.wait(1)
  console.log(`Congrats!, You have successfully borrowed DAI`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
