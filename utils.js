

const priceFormat = (amount) => {
    amount = parseFloat(amount)
    return amount.toFixed(2);
  };
  const apyFormat = (amount) => {
    console.log("apy amount format", amount);
    if (amount === 0) {
      return "n/a";
    }
  
    let apy = parseFloat(amount * 100);
    apy = apy.toFixed(2);
  
    return apy.toString();
  };

  const aprToApy = (interest, frequency = 365) => ((1 + (interest / 100) / frequency) ** frequency - 1) * 100;

  const commas = (string) => {
    let number = parseFloat(string);
    let fixed = number.toFixed();
    return fixed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  module.exports = { priceFormat, apyFormat, commas, aprToApy };
