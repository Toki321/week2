// [assignment] please copy the entire modified custom.test.js here
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers

const Utxo = require('../src/utxo')
const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
const { toFixedHex, poseidonHash } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MINIMUM_WITHDRAWAL_AMOUNT = utils.parseEther(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '0.05')
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

describe('Custom Tests', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    require('../scripts/compileHasher')
    const [sender, gov, l1Unwrapper, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')

    const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
    await token.mint(sender.address, utils.parseEther('10000'))

    const amb = await deploy('MockAMB', gov.address, l1ChainId)
    const omniBridge = await deploy('MockOmniBridge', amb.address)

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      token.address,
      omniBridge.address,
      l1Unwrapper.address,
      gov.address,
      l1ChainId,
      multisig.address,
    )

    const { data } = await tornadoPoolImpl.populateTransaction.initialize(
      MINIMUM_WITHDRAWAL_AMOUNT,
      MAXIMUM_DEPOSIT_AMOUNT,
    )
    const proxy = await deploy(
      'CrossChainUpgradeableProxy',
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId,
    )

    const tornadoPool = tornadoPoolImpl.attach(proxy.address)

    await token.approve(tornadoPool.address, utils.parseEther('10000'))

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig }
  }

  it('[assignment] ii. deposit 0.1 ETH in L1 -> withdraw 0.08 ETH in L2 -> assert balances', async () => {
      // [assignment] complete code here

      const { tornadoPool, token, omniBridge } = await loadFixture(fixture)

      const aliceKeys = new Keypair() 
      const aliceAddress = aliceKeys.address()
  
      const aliceDeposit = utils.parseUnits('0.1')
      const depositUtxo = new Utxo({ amount: aliceDeposit })
      const { args, extData } = await prepareTransaction({ tornadoPool, outputs: [depositUtxo] })
      const tokenBridge = encodeDataForBridge({ proof: args, extData })
      const bridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        depositUtxo.amount,
        tokenBridge,
      )
  
      await token.transfer(omniBridge.address, aliceDeposit)
      const transfer = await token.populateTransaction.transfer(tornadoPool.address, aliceDeposit)
  
      await omniBridge.execute([
        { who: token.address, callData: transfer.data },
        { who: tornadoPool.address, callData: bridgedTx.data },
      ])
  
     
      const aliceWithdraw = utils.parseUnits('0.08')
      const recipient = '0x0000000000000000000000000000000000000001'
      const withdrawUtxo = new Utxo({
        amount: aliceDeposit.sub(aliceWithdraw),
        keypair: aliceKeys,
      })
      await transaction({
        tornadoPool,
        inputs: [depositUtxo],
        outputs: [withdrawUtxo],
        recipient: recipient,
      })
  
      
      expect(await token.balanceOf(recipient)).to.eq(utils.parseUnits('0.08'))
  
      const bridgeAmount = await token.balanceOf(omniBridge.address)
      expect(bridgeAmount).to.eq(0)
  
      const poolAmount = await token.balanceOf(tornadoPool.address)
      expect(poolAmount).to.eq(utils.parseUnits('0.02'))
  })

  it('[assignment] iii. see assignment doc for details', async () => {
      // [assignment] complete code here
      const { tornadoPool, token, omniBridge } = await loadFixture(fixture)

    const aliceKeys = new Keypair() 
    const aliceAddress = aliceKeys.address()

    const aliceDeposit = utils.parseUnits('0.1')
    const depositUtxo = new Utxo({ amount: aliceDeposit })
    const { args, extData } = await prepareTransaction({ tornadoPool, outputs: [depositUtxo] })
    const tokenBridgedData = encodeDataForBridge({ proof: args, extData })
    const tokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
      token.address,
      depositUtxo.amount,
      tokenBridgedData,
    )

    await token.transfer(omniBridge.address, aliceDeposit)
    const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDeposit)

    await omniBridge.execute([
      { who: token.address, callData: transferTx.data },
      { who: tornadoPool.address, callData: tokenBridgedTx.data },
    ])

    
    const withdrawAmount = utils.parseUnits('0.08')
    const recipient = '0x0000000000000000000000000000000000000001'
    const withdrawUtxo = new Utxo({
      amount: aliceDeposit.sub(withdrawAmount),
      keypair: aliceKeys,
    })
    await transaction({
      tornadoPool,
      inputs: [depositUtxo],
      outputs: [withdrawUtxo],
      recipient: recipient,
    })

    expect(await token.balanceOf(recipient)).to.eq(utils.parseUnits('0.08'))

    const poolBalance = await token.balanceOf(tornadoPool.address)
    expect(poolBalance).to.eq(utils.parseUnits('0.02'))

    const bridgeBalance = await token.balanceOf(omniBridge.address)
    expect(bridgeBalance).to.eq(0)
   
  })

  it('[assignment] iii. see assignment doc for details', async () => {
    const { tornadoPool, token, omniBridge } = await loadFixture(fixture)
    const aliceKeys = new Keypair()
    const aliceAddress = aliceKeys.address()
    const bobKeypair = new Keypair()
    const bobAddress = bobKeypair.address()

    const aliceDeposit = utils.parseUnits('0.13')
    const depositUtxo = new Utxo({ amount: aliceDeposit, keypair: aliceKeys })

    const { args, extData } = await prepareTransaction({ tornadoPool, outputs: [depositUtxo] })
    const bridgeData = encodeDataForBridge({ proof: args, extData })
    const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
      token.address,
      depositUtxo.amount,
      bridgeData,
    )

    await token.transfer(omniBridge.address, aliceDeposit)
    const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDeposit)

    await omniBridge.execute([
      { who: token.address, callData: transferTx.data },
      { who: tornadoPool.address, callData: onTokenBridgedTx.data },
    ])

    const sendAmount = utils.parseUnits('0.06')
    const sendUtxo = new Utxo({ amount: sendAmount, keypair: Keypair.fromString(bobAddress) })
    const aliceChangeUtxo = new Utxo({
      amount: aliceDeposit.sub(sendAmount),
      keypair: depositUtxo.keypair,
    })

    await transaction({ tornadoPool, inputs: [depositUtxo], outputs: [sendUtxo, aliceChangeUtxo] })

    const bobBalanceUtxo = new Utxo({
      amount: sendAmount,
      keypair: bobKeypair,
      blinding: sendUtxo.blinding,
    })
    const bob = '0x0000000000000000000000000000000000000001'
    await transaction({
      tornadoPool,
      inputs: [bobBalanceUtxo],
      recipient: bob,
    })

    const alice = '0x1234560000000000000000000000000000000002'
    await transaction({
      tornadoPool,
      inputs: [aliceChangeUtxo],
      recipient: alice,
      isL1Withdrawal: true,
    })

    const bobBalance = await token.balanceOf(bob)
    expect(bobBalance).to.be.equal(utils.parseUnits('0.06'))

    const aliceBalance = await token.balanceOf(alice)
    expect(aliceBalance).to.be.equal(0)

    const bridgeBalance = await token.balanceOf(omniBridge.address)
    expect(bridgeBalance).to.be.equal(utils.parseUnits('0.07'))

    const poolBalance = await token.balanceOf(tornadoPool.address)
    expect(poolBalance).to.be.equal(0)
  })
})
