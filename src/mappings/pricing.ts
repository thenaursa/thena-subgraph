/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, UNTRACKED_PAIRS } from './helpers'

const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
const WBNB_BUSD_PAIR = '0x483653bcf3a10d9a1c334ce16a19471a614f4385'
const USDT_WBNB_PAIR = '0x6be6a437a1172e6c220246ecb3a92a45af9f0cbc'
const USDC_WBNB_PAIR = '0x4cd8a94975e275bd327431e2225f3afba73b56d7'

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(USDC_WBNB_PAIR) // USDC is token0
  let usdtPair = Pair.load(USDT_WBNB_PAIR) // USDT is token0
  let busdPair = Pair.load(WBNB_BUSD_PAIR) // BUSD is token1

  // all 3 have been created
  if (usdtPair !== null && usdcPair !== null && busdPair !== null) {
    let totalLiquidityBNB = usdtPair.reserve1.plus(usdcPair.reserve1).plus(busdPair.reserve0)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB)
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityBNB)
    let busdWeight = busdPair.reserve0.div(totalLiquidityBNB)
    return usdtPair.token0Price
      .times(usdtWeight)
      .plus(usdcPair.token0Price.times(usdcWeight))
      .plus(busdPair.token1Price.times(busdWeight))
    // USDT and BUSD have been created
  } else if (usdtPair !== null && busdPair !== null) {
    let totalLiquidityBNB = usdtPair.reserve1.plus(busdPair.reserve0)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB)
    let busdWeight = busdPair.reserve0.div(totalLiquidityBNB)
    return usdtPair.token0Price.times(usdtWeight).plus(busdPair.token1Price.times(busdWeight))
    // BUSD is the only pair so far
  } else if (busdPair !== null) {
    return busdPair.token1Price
  } else {
    return ZERO_BD
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
  '0x55d398326f99059ff775485246999027b3197955', // USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // ETH
  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
  '0x90c97f71e18723b0cf0dfa30ee176ab653e89f40', // FRAX
  '0xfa4ba88cf97e282c505bea095297786c16070129', // CUSD
  '0x2f29bc0ffaf9bff337b31cbe6cb5fb3bf12e5840', // DOLA
  '0x0782b6d8c4551b9760e74c0545a9bcd90bdc41e5', // HAY
  '0xe80772eaf6e2e18b651f160bc9158b2a5cafca65', // USD+
  '0x1bdd3cf7f79cfb8edbb955f20ad99211551ba275', // BNBx
  '0xf307910a4c7bbc79691fd374889b36d8531b08e3', // Ankr
  '0x52f24a5e03aee338da5fd9df68d2b6fae1178827', // AnkrBNB
  '0x64048a7eecf3a2f1ba9e144aac3d7db6e58f555e', // frxETH
  '0x431e0cd023a32532bf3969cddfc002c00e98429d', // XCAD
  '0xcc42724c6683b7e57334c4e856f4c9965ed682bd', // MATIC
  '0xf4c8e32eadec4bfe97e0f595add0f4450a863a11', // THE
  '0x1ce0c2827e2ef14d5c4f29a091d735a204794041', // AVAX
  '0xe5c6155ed2924e50f998e28eff932d9b5a126974', // LQDR
  '0x71be881e9c5d4465b3fff61e89c6f3651e69b5bb', // BRZ
  '0x316622977073bbc3df32e7d2a9b3c77596a0a603', // jBRL
  '0x0b15ddf19d47e6a86a56148fb4afffc6929bcb89', // IDIA
]

// minimum liquidity for price to get tracked
let MINIMUM_VOLATILE_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('3')

// minimum liquidity for price to get tracked
let MINIMUM_STABLE_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('30')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WBNB_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let volatilePairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]), false)
    if (volatilePairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(volatilePairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_VOLATILE_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_VOLATILE_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
    let stablePairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]), true)
    if (stablePairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(stablePairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_STABLE_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return token1.derivedETH as BigDecimal // return Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_STABLE_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return token0.derivedETH as BigDecimal // return ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return ZERO_BD
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
