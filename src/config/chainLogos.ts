// Map chain names to their corporate domains for Clearbit logo API
// https://logo.clearbit.com/<domain>
export const chainDomainMap: Record<string, string> = {
  // Albertsons family
  'Albertsons / Safeway - HQ': 'albertsons.com',
  'Albertsons / Safeway - NorCal': 'albertsons.com',
  'Albertsons / Safeway - Mid-Atlantic': 'albertsons.com',
  'Albertsons / Safeway - SoCal': 'albertsons.com',
  'Safeway': 'albertsons.com',

  // Kroger family
  'Kroger HQ': 'kroger.com',
  'Kroger': 'kroger.com',
  'Fred Meyer': 'fredmeyer.com',
  'Ralphs': 'ralphs.com',
  'Food 4 Less': 'food4less.com',
  'Harris Teeter': 'harristeeter.com',
  'King Soopers': 'kingsoopers.com',
  'Smith\'s': 'smithsfoodanddrug.com',
  'QFC': 'qfc.com',
  'Fry\'s': 'frysfood.com',
  'Pay Less': 'paylessfoods.com',
  'Metro Market': 'metromarketskroger.com',
  'Dillons': 'dillons.com',

  // Regional/National chains
  'ALDI': 'aldi.us',
  'Casey\'s': 'caseys.com',
  'Food Lion': 'foodlion.com',
  'Publix': 'publix.com',
  'HEB': 'heb.com',
  'Sprouts': 'sprouts.com',
  'Whole Foods': 'wholefoodsmarket.com',
  'Amazon Fresh': 'amazonfresh.com',
  'Trader Joe\'s': 'traderjoes.com',
  'Wegmans': 'wegmans.com',
  'Winn-Dixie': 'winndixie.com',
  'Giant Food': 'giantfood.com',
  'Stop & Shop': 'stopandshop.com',
  'Food Depot': 'fooddepot.com',
  'Piggly Wiggly': 'pigglywiggly.com',
  'Save-A-Lot': 'savealot.com',
  'Hy-Vee': 'hy-vee.com',
  'Supervalu': 'supervalu.com',
  'Instacart': 'instacart.com',

  // Convenience/Gas
  'Murphy USA': 'murphyusa.com',
  'Quiktrip': 'quiktrip.com',
  'Kwik Trip': 'kwiktrip.com',
  'Speedway': 'speedway.com',
  'Circle K': 'circlek.com',
  'RaceTrac': 'racetrac.com',
  'GetGo': 'getgoplus.com',
  'Loves': 'loves.com',
  'Sheetz': 'sheetz.com',
  'Bucees': 'buc-ees.com',
  'Rutter\'s': 'rutters.com',
  'Maverick': 'maverikconvenience.com',
  'Eg America': 'egamerica.com',
  'TA/Petro': 'tatravelcenters.com',
  'Valero': 'valero.com',
  'Caltex': 'caltex.com.au',
  'Citgo': 'citgo.com',
  'Sunoco': 'sunocogasandgo.com',

  // Mass/Multi-format
  'Walmart': 'walmart.com',
  'Target': 'target.com',
  'Costco': 'costco.com',
  'Sams Club': 'samsclub.com',
  'BJ\'s': 'bjs.com',

  // Discount/Value
  'Dollar General': 'dollargeneral.com',
  'Dollar Tree': 'dollartree.com',
  'Five Below': 'fivebelow.com',

  // E-commerce
  'Amazon': 'amazon.com',
  'Thrive Market': 'thrivemarket.com',
  'Good Eggs': 'goodeggs.com',

  // Meal Kit / Direct
  'HelloFresh': 'hellofresh.com',
  'EveryPlate': 'everyplate.com',
  'Green Chef': 'greenchef.com',

  // Pharmacy/Drug Store
  'CVS': 'cvs.com',
  'Walgreens': 'walgreens.com',
  'Rite Aid': 'riteaid.com',
  'Duane Reade': 'duanereade.com',

  // Delivery/Other
  'Delivery Only': 'instacart.com',
}

export function getChainDomain(chainName: string): string | null {
  return chainDomainMap[chainName] || null
}

export function getLogoUrl(chainName: string): string {
  const domain = getChainDomain(chainName)
  if (domain) {
    return `https://logo.clearbit.com/${domain}`
  }
  return ''
}

export function getChainInitials(chainName: string): string {
  // Extract initials from chain name
  return chainName
    .split(/[\s\-\/]+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
