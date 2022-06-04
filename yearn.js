const { Client, Intents } = require("discord.js");

const pgp = require("pg-promise")(/* initialization options */);

const ethers = require("ethers");
const fetch = require("cross-fetch");

const { priceFormat, apyFormat, commas, aprToApy } = require("./utils.js");

const dotenv = require("dotenv");
dotenv.config();

const Discord = require("discord.js");
const { MessageEmbed } = require("discord.js");

const client = new Discord.Client({
  partials: ["CHANNEL"],
  intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"],
});

const ethereumEndpoint =
  "https://mainnet.infura.io/v3/" + process.env.ETHEREUM_KEY;
const ethereumProvider = new ethers.providers.JsonRpcProvider(ethereumEndpoint);

// const fantomEndpoint = process.env.FANTOM
const fantomEndpoint = "https://rpc.ftm.tools/";
const arbitrumEndpoint = "https://arb1.arbitrum.io/rpc";
const fantomProvider = new ethers.providers.JsonRpcProvider(fantomEndpoint);
const arbitrumProvider = new ethers.providers.JsonRpcProvider(arbitrumEndpoint);

let vaultAbi = [
  "function pricePerShare() public view returns (uint256)",
  "function decimals() public view returns (uint256)",
];

const cn = {
    host: "localhost", // server name or IP address;
    port: 5432,
    database: "nft",
    user: process.env.USER,
    password: process.env.PASSWORD,
  };
  const db = pgp(cn);

  async function removeCollection(discord, collection) {
    try {
      let queryAddWallet =
        "DELETE FROM gallery WHERE DISCORD='" +
        discord +
        "' AND COLLECTION='" +
        collection +
        "';";
      //   console.log("deleting: ",queryAddWallet)
      let addWallet = await db.any(queryAddWallet);
      return "Collection `" + collection + "` removed!";
    } catch (error) {
      console.log(error);
      return "Could not remove that collection friend, sorry!";
    }
  }

async function addCollection(discord, collection) {
    try {
      let user = await getUser(discord);
      let collectionReturned = await seaFetch(collection)
      if(collectionReturned.success !== false) {
      if (user.length > 9) {
        return "You have hit the maximum of 10 collections";
      }
      let queryAddWallet =
        "INSERT INTO gallery(DISCORD,COLLECTION) values('" +
        discord +
        "','" +
        collection +
        "');";
      //   console.log("adding: ",queryAddWallet)
      let addWallet = await db.any(queryAddWallet);
      return "Collection `" + collection + "` added!";}
      else{return "Collection not found"}
    } catch (error) {
      console.log(error);
      return "Could not add that collection friend, sorry!";
    }
  }


async function getUser(discord) {
    let queryUser =
      "SELECT discord,collection FROM gallery WHERE discord='" + discord + "';";
    try {
      let user = await db.any(queryUser);
      return user;
    } catch (error) {
      return {};
    }
  }

async function discordGallery(discord) {
    try {
      let playerWalletsQuery =
        "SELECT DISCORD,COLLECTION from gallery WHERE DISCORD ='" + discord + "';";
      let playerWalletsReturn = await db.any(playerWalletsQuery);
      //   console.log(playerWalletsReturn)
      let count = 1;
      var walletsString = "";
      console.log(playerWalletsQuery)
      for (const player of playerWalletsReturn){
        let fetched = await seaFetch(player.collection)
        let floorPrice = fetched.stats.floor_price
        console.log(floorPrice)
        walletsString +=  player.collection + " `" + floorPrice + "`\n";
        count += 1;
      }
      
      if (walletsString === "") {
        return "No collections stored. try `=add <collection name>`";
      } else {
        return walletsString;
      }
    } catch (error) {
      console.log(error);
      return "No collections stored. try `=add <collection name>`";
    }
  }

// only fantom for now
async function oneDayAgoPrice(vault) {
  let url =
    "https://yearnapybot.azurewebsites.net/api/chains/250/vaults/" +
    vault +
    "/pps/1d";
  console.log("url: ", url);
  try {
    let priceHistoryFetch = await fetch(url);
    let priceHistoryJson = await priceHistoryFetch.json();
    let oneDayAgo = {
      price: priceHistoryJson.pps[0],
      timestamp: priceHistoryJson.timestamps[0],
    };
    return oneDayAgo;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

// only fantom for now
async function thirtyDayAgoPrice(vault) {
  let url =
    "https://yearnapybot.azurewebsites.net/api/chains/250/vaults/" +
    vault +
    "/pps/30d";
  try {
    let priceHistoryFetch = await fetch(url);
    let priceHistoryJson = await priceHistoryFetch.json();
    let oneDayAgo = {
      price: priceHistoryJson.pps[0],
      timestamp: priceHistoryJson.timestamps[0],
    };
    return oneDayAgo;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

async function listFantomVaults() {
  try {
    let vaults = await fetchApi(250);
    // let vaults = fantomBlob;
    let vaultArray = [];
    vaults.forEach((yearnGrab) => {
      console.log(yearnGrab.symbol);
      if (!vaultArray[yearnGrab.symbol]) {
        vaultArray.push(yearnGrab.symbol);
      }
    });

    return vaultArray;
  } catch (error) {
    console.log("listFantomVaults error", error);
  }
}

async function listVaults(chain) {
  let chainId = 1
  if(chain === 42161) {chainId = 42161} 
  try {
    let vaults = await fetchApi(chainId);
    // let vaults = mainBlob;
    let vaultArray = [];
    vaults.forEach((yearnGrab) => {
      console.log(yearnGrab.symbol);
      if (!vaultArray[yearnGrab.symbol]) {
        vaultArray.push(yearnGrab.symbol);
      }
    });

    return vaultArray;
  } catch (error) {
    console.log("listVaults error", error);
  }
}
async function getPricePerShare(vaultAddress, network) {
  try {
    let vaultContract = {};
    if (network === 42161) {
      vaultContract = new ethers.Contract(
        vaultAddress,
        vaultAbi,
        arbitrumProvider
      );
    }

    if (network === 250) {
      vaultContract = new ethers.Contract(
        vaultAddress,
        vaultAbi,
        fantomProvider
      );
    }
    if (network === 1) {
      vaultContract = new ethers.Contract(
        vaultAddress,
        vaultAbi,
        ethereumProvider
      );
    }
    // console.log("vaultcontract", vaultContract);
    let decimals = await vaultContract.decimals();
    let pricePerShare = await vaultContract.pricePerShare();

    pricePerShare = parseFloat(
      ethers.utils.formatUnits(pricePerShare, decimals)
    );
    // console.log("ppps:", pricePerShare);
    return pricePerShare;
  } catch (error) {
    console.log("price per share fail ", vaultAddress, error);
    return 0;
  }
}

async function historicalPrice(vault, network) {
  let url =
    "https://yearnapybot.azurewebsites.net/api/chains/" +
    network +
    "/vaults/" +
    vault +
    "/pps/1d";
  let url7d =
    "https://yearnapybot.azurewebsites.net/api/chains/" +
    network +
    "/vaults/" +
    vault +
    "/pps/7d";
  let url30d =
    "https://yearnapybot.azurewebsites.net/api/chains/" +
    network +
    "/vaults/" +
    vault +
    "/pps/30d";
  // console.log("url: ", url);
  try {
    let [priceHistoryFetch, priceHistoryFetch7d, priceHistoryFetch30d] =
      await Promise.all([fetch(url), fetch(url7d), fetch(url30d)]);
    let priceHistoryJson = await priceHistoryFetch.json();
    let priceHistoryJson7d = await priceHistoryFetch7d.json();
    let priceHistoryJson30d = await priceHistoryFetch30d.json();

    let history = {
      oneDayAgo: {
        price: priceHistoryJson.pps[0],
        timestamp: priceHistoryJson.timestamps[0],
      },
      sevenDayAgo: {
        price: priceHistoryJson7d.pps[0],
        timestamp: priceHistoryJson7d.timestamps[0],
      },
      thirtyDayAgo: {
        price: priceHistoryJson30d.pps[0],
        timestamp: priceHistoryJson30d.timestamps[0],
      },
    };
    return history;
  } catch (error) {
    console.log(error);
    return 0;
  }
}
async function allSea(collectionName) {
  try{
    let fetchedSea = await seaFetch(collectionName)
    let floorPrice = fetchedSea.stats.floor_price
    let numOwners = fetchedSea.stats.num_owners
    let totalVolume = fetchedSea.stats.total_volume
    let totalSupply = fetchedSea.stats.total_supply
    let seaEmbed = new MessageEmbed()
    .setColor("#0099ff")
    .setTitle("OpenSea Details for `"  + collectionName + "`")
    .setDescription("Floor Price `" + floorPrice + "`" +
    "\nOwners `" + numOwners + "`" +
    "\nTotal Volume `" + totalVolume.toFixed(0) + "`" +
    "\nTotal Supply `" + totalSupply + "`"
    )
    .setImage();
    return seaEmbed

}catch(error){console.log(error)}
}
async function seaFloor(collectionName) {
    try{
        let fetchedSea = await seaFetch(collectionName)
        let floorPrice = fetchedSea.stats.floor_price
        if (floorPrice === null) {
            let oneDayAvgPrice = parseFloat(fetchedSea.stats.one_day_average_price) 
            return "__OpenSea__ One Day Average Price For:\n`"+ collectionName + "` \ \ \ \ \ `" + oneDayAvgPrice.toFixed(2) + "` \ \ \ `ETH`"

        }else {
        return "__OpenSea__ Floor Price For:\n`"+ collectionName + "` \ \ \ \ \ `" + floorPrice + "` \ \ \ `ETH`"
        }

    }catch(error) {return "Collection not found";console.log(error)}
}

async function seaFetch(collectionName) {
  try {
    let fetchSea = await fetch("https://api.opensea.io/api/v1/collection/" + collectionName + "/stats")
        let fetchedSea = await fetchSea.json()
        return fetchedSea

  }catch(error){console.log(error)}
}

async function run() {
  client.once("ready", () => {
    console.log("Ready!");
  });
  client.on("messageCreate", (message) => {
    // .addField('', '', true)
    // if (message.content === "=vaults") {
    // }
    if(message.content.startsWith("=floor")) {
            let seaRequest = message.content.split(" ");
            let collection = seaRequest[1];
            seaFloor(collection).then(sea =>{message.reply(sea)}

            )
    }
    if(message.content.startsWith("=sea")) {
      let seaRequest = message.content.split(" ");
      let collection = seaRequest[1];
      allSea(collection).then(sea =>{message.reply({embeds: [sea]})}

      )
}
    if (message.content === "=ftmvaults") {
      let listString = "";
      {
        listFantomVaults().then((vaultList) => {
          vaultList.forEach((vault) => {
            listString += " `" + vault + "`";
          });
          message.reply(listString);
        });
      }
    }
    if (message.content === "=arbvaults" || message.content === "=arbitrumvaults") {
      let listString = "";
      {
        listVaults(42161).then((vaultList) => {
          vaultList.forEach((vault) => {
            listString += " `" + vault + "`";
          });
          message.reply(listString);
        });
      }
    }
    if (message.content.startsWith("=strat")) {
      try {
        let vaultRequest = message.content.split(" ");
        let vault = vaultRequest[1];
        getStrategyNames(vault, 1).then((description) => {
          const vaultsEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(vault + " Strategy")
            .setDescription(description)
            .setImage();
          message.reply({ embeds: [vaultsEmbedMsg] });
        });
      } catch (error) {
        console.log(error);
        message.reply("Failed to fetch, friend.");
      }
    }
    if (message.content.startsWith("=ftmstrat")) {
      try {
        let vaultRequest = message.content.split(" ");
        let vault = vaultRequest[1];
        getStrategyNames(vault, 250).then((description) => {
          const vaultsEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(vault + " Strategy")
            .setDescription(description)
            .setImage();
          message.reply({ embeds: [vaultsEmbedMsg] });
        });
      } catch (error) {
        console.log(error);
        message.reply("Failed to fetch, friend.");
      }
    }
    if (message.content.startsWith("=desc")) {
      try {
        let vaultRequest = message.content.split(" ");
        let vault = vaultRequest[1];
        getStrategyDescription(vault, 1).then((description) => {
          const vaultsEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(vault + " Strategy Description")
            .setDescription(description)
            .setImage();
          message.reply({ embeds: [vaultsEmbedMsg] });
        });
      } catch (error) {
        console.log(error);
        message.reply("Failed to fetch, friend.");
      }
    }

    if (message.content === "=vaults") {
      let listString = "";
      {
        listVaults().then((vaultList) => {
          vaultList.forEach((vault) => {
            listString += " `" + vault + "`";
          });
          const vaultsEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle("Mainnet Vaults")
            .setDescription(listString)
            .setImage();
          message.reply({ embeds: [vaultsEmbedMsg] });
        });
      }
    }

    // 30 day APY testing
    if (
      message.content.startsWith("=apy ") ||
      message.content.startsWith("=ftmapy ") ||
      message.content.startsWith("=fantomapy ")
    ) {
      let vaultRequest = message.content.split(" ");
      let vault = vaultRequest[1];
      let network = 1; // default mainnet
      if (
        message.content.startsWith("=ftmapy ") ||
        message.content.startsWith("=fantomapy ")
      ) {
        network = 250;
      }
      //   let vaultInfo = await vaultData(vault);
      try {
        getVaultApy(vault, network).then((vaultObject) => {
          if (vaultObject === 0) {
            message.reply("Could not find that vault friend.");
            return;
          }
          let vault = vaultObject;
          // console.log("vaul object from data:", vault);
          //   let embedReturn = vaultEmbed(vaultObject);
          let explorer = "https://etherscan.io/address/";
          let explorerName = "Etherscan";
          if (network === 250) {
            explorer = "https://ftmscan.com/address/";
            explorerName = "Ftmscan";
          }
          let tvl = "TVL    `$" + commas(vault.tvl) + "`";
          let apy = "`" + apyFormat(vault.apy) + "%` ";
          let vaultLink = explorer + vault.address;
          let tokenLink = explorer + vault.tokenAddress;
          let footerText =
            "[Vault](" +
            vaultLink +
            ") & [token](" +
            tokenLink +
            ") on " +
            explorerName;
          let price = priceFormat(vault.price);
          let oneWeek = "n/a";
          let oneMonth = "n/a";
          let allTime = "n/a";
          let apyFields = "";
          let apyString = "";
          let pricePerShare = vault.pps;
          if (pricePerShare === 0) {
            pricePerShare = "--";
          }
          // console.log(vault.icon, "icon");
          // console.log("price pershare", pricePerShare);
          // console.log("footer", footerText);

          if (vault.historicData !== null) {
            // console.log("has historic data");
            oneWeek = apyFormat(vault.weekAgo) + "%";
            oneMonth = apyFormat(vault.monthAgo) + "%";
            allTime = apyFormat(vault.allTime) + "%";
            apyString =
              apy + " APY    " + vault.name + "  (" + vault.symbol + ")     ";
            // apyFields = [
            //   { name: "1wk", value: oneWeek, inline: true },
            //   { name: "1mo", value: oneMonth, inline: true },
            //   { name: "Alltime", value: allTime, inline: true },
            // ];
            if (network === 250) {
              // console.log("one dayyyyyyy ", vault.oneDayApy);
              apyString += "    24h: `" + vault.oneDayApy + "`";
              // apyFields.unshift({
              //   name: "24h",
              //   value: vault.oneDayApy,
              //   inline: true,
              // });
              // console.log("apy fields ", apyFields);
            }
            apyString += "   7d: `" + oneWeek + "`    1mo: `" + oneMonth + "`";
          } else {
            apyString = "Historic APY not available";
            console.log("no historic data");
          }
          // const vaultEmbedMsg = new MessageEmbed()
          //   .setColor("#0099ff")
          //   .setTitle(vault.name + "  (" + vault.symbol + ")     " + apy)
          //   .setDescription(
          //     "PRICE  `" +
          //       price +
          //       "` \n PPS  `" +
          //       pricePerShare +
          //       "` \n" +
          //       tvl +
          //       " \n STRATS  `" +
          //       vault.strategies +
          //       "`"
          //   )
          //   .setThumbnail(vault.icon)
          //   .setImage()
          //   .addFields(apyFields)
          //   .addField("\u200B", footerText);
          // console.log("vault msg: ", vaultEmbedMsg);
          message.reply(apyString);
        });
      } catch (error) {
        console.log(error);
        message.reply("Could not find that vault friend.");
      }
    }
    // 30 day APY testing ^^

    const botChannelId = "737086733975289967";
    const communityModRoleId = "787425582114668554";
    const larryRole = "940110715090505769";
    // if(message.member.roles.cache.has(larryRole)) {
    //   message.reply("ya dog")
    // }
    // if (
    //   message.channel.id === botChannelId ||
    //   message.member.roles.cache.has(communityModRoleId))

    //   {
    if (message.content === "=test") {
      try {
        runTest().then((testResult) => {
          message.reply(
            "AZURE:" + testResult.azure + " MIM: " + testResult.mim
          );
        });
      } catch (error) {
        console.log(error);
      }
    }

  if (message.content.startsWith("=add")) {
    let addQuery = message.content.split(" ");
    wallet = addQuery[1];

    try {
      //  let fetchedSea = await seaFetch(x.collection)
       
      // check for user limit and existing address
      let user = message.author.id;
      addCollection(user, wallet).then((addText) => {
        message.reply(addText);
      });
    } catch (error) {
      message.reply("Invalid collection");
    }
  }
  if (message.content === "=gallery") {
   try {
            discordGallery(message.author.id).then((galleryText) => {
              //    console.log("=list text: ",walletsText);
              message.reply(galleryText);
            });
          } catch (error) {
            message.reply(
              "No collections stored. You can `=add <wallet address>`"
            );
          }
        }

        if (message.content.startsWith("=remove")) {
            let addQuery = message.content.split(" ");
            wallet = addQuery[1];
            try {
              //  let fetchedSea = await seaFetch(x.collection)
              let user = message.author.id;
              removeCollection(user, wallet).then((removeText) => {
                message.reply(removeText);
              });
            } catch (error) {
              message.reply("Invalid collection");
            }
          }
        
    if (
      message.content.startsWith("=vision") ||
      message.content.startsWith("=ftmvision")
    ) {
      let vaultRequest = message.content.split(" ");
      let vault = vaultRequest[1];
      let network = 1; // default mainnet
      if (message.content.startsWith("=ftmvision")) {
        network = 250;
      }
      try {
        getVaultDataVision(vault, network).then((vaultObject) => {
          if (vaultObject === 0) {
            message.reply("Could not find that vault friend.");
            return;
          }
          let vault = vaultObject;
          // console.log("vault object from data:", vault);
          //   let embedReturn = vaultEmbed(vaultObject);
          let explorer = "https://etherscan.io/address/";
          let explorerName = "Etherscan";
          if (network === 250) {
            explorer = "https://ftmscan.com/address/";
            explorerName = "Ftmscan";
          }
          let tvl = "TVL    `$" + commas(vault.tvl) + "`";
          let apy = "`" + apyFormat(vault.apy) + "%` ";

          let vaultLink = explorer + vault.address;
          let tokenLink = explorer + vault.tokenAddress;
          let footerText =
            "[Vault](" +
            vaultLink +
            ") & [token](" +
            tokenLink +
            ") on " +
            explorerName;

          let price = priceFormat(vault.price);
          let oneWeek = "n/a";
          let oneMonth = "n/a";
          let allTime = "n/a";

          let apyFields = "";

          let pricePerShare = vault.pps;
          if (pricePerShare === 0) {
            pricePerShare = "--";
          }
          // console.log(vault.icon, "icon");
          // console.log("price pershare", pricePerShare);
          // console.log("footer", footerText);

          if (vault.historicData !== null) {
            oneWeek = apyFormat(vault.weekAgo) + "%";
            oneMonth = apyFormat(vault.monthAgo) + "%";
            allTime = apyFormat(vault.allTime) + "%";

            apyFields = [
              { name: "1wk", value: oneWeek, inline: true },
              { name: "1mo", value: oneMonth, inline: true },
              { name: "Alltime", value: allTime, inline: true },
            ];
            if (network === 250) {
              // console.log("one dayyyyyyy ", vault.oneDayApy);
              // console.log("seven day apyyy",vault.sevenDayApy)
              // console.log("thirty day apyyy",vault.thirtyDayApy)

              apyFields.unshift({
                name: "24h",
                value: vault.oneDayApy,
                inline: true,
              });
              // console.log("apy fields ", apyFields);
            }
          } else {
            apyFields = [{ name: "--", value: "Historic APY not available" }];
            console.log("no historic data");
          }
          const vaultEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(vault.name + "  (" + vault.symbol + ")     " + apy)
            .setDescription(
              "PRICE  `" +
                price +
                "` \n PPS  `" +
                pricePerShare +
                "` \n" +
                tvl +
                " \n STRATS  `" +
                vault.strategies +
                "`"
            )
            .setThumbnail(vault.icon)
            .addFields(apyFields)
            .addField("\u200B", footerText);
          // console.log("vault embed msg: ", vaultEmbedMsg);
          // message.reply({ embeds: [vaultEmbedMsg] });
          message.reply(
            vault.name +
              "   1d: " +
              vault.oneDayApy +
              "   7d: " +
              vault.sevenDayApy +
              "   30d: " +
              vault.thirtyDayApy
          );
        });
      } catch (error) {
        console.log(error);
        message.reply("Could not find that vault friend.");
      }
    }
    if (
      message.content.startsWith("=ftmvault ") ||
      message.content.startsWith("=vault ") ||
      message.content.startsWith("=fantomvault ") ||
      message.content.startsWith("=arbvault") ||
      message.content.startsWith("=arbitrumvault") ||
      message.content.startsWith("=arbivault")
    ) {
      let vaultRequest = message.content.split(" ");
      let vault = vaultRequest[1];
      let network = 1; // default mainnet
      let explorer = "https://etherscan.io/address/";
      let explorerName = "Etherscan";
      if (
        message.content.startsWith("=ftmvault ") ||
        message.content.startsWith("=fantomvault ")
      ) {
        network = 250;
        explorer = "https://ftmscan.com/address/";
        explorerName = "Ftmscan";
      }

      if (
        message.content.startsWith("=arbvault") ||
        message.content.startsWith("=arbitrumvault") ||
        message.content.startsWith("=arbivault")
      ) {
        network = 42161;
        explorer = "https://arbiscan.io/address/";
        explorerName = "Arbiscan";
      }
      //   let vaultInfo = await vaultData(vault);
      try {
        getVaultData(vault, network).then((vaultObject) => {
          if (vaultObject === 0) {
            message.reply("Could not find that vault friend.");
            return;
          }
          let vault = vaultObject;
          // console.log("vaul object from data:", vault);
          //   let embedReturn = vaultEmbed(vaultObject);

          let tvl = "TVL    `$" + commas(vault.tvl) + "`";
          let apy = "`" + apyFormat(vault.apy) + "%` ";

          let vaultLink = explorer + vault.address;
          let tokenLink = explorer + vault.tokenAddress;
          let footerText =
            "[Vault](" +
            vaultLink +
            ") & [token](" +
            tokenLink +
            ") on " +
            explorerName;

          let price = priceFormat(vault.price);
          let oneWeek = "n/a";
          let oneMonth = "n/a";
          let allTime = "n/a";

          let apyFields = "";

          let pricePerShare = vault.pps;
          if (pricePerShare === 0) {
            pricePerShare = "--";
          }
          // console.log(vault.icon, "icon");
          // console.log("price pershare", pricePerShare);
          // console.log("footer", footerText);

          if (vault.historicData !== null) {
            oneWeek = apyFormat(vault.weekAgo) + "%";
            oneMonth = apyFormat(vault.monthAgo) + "%";
            allTime = apyFormat(vault.allTime) + "%";

            apyFields = [
              { name: "1wk", value: oneWeek, inline: true },
              { name: "1mo", value: oneMonth, inline: true },
              { name: "Alltime", value: allTime, inline: true },
            ];
            if (network === 250) {
              // console.log("one dayyyyyyy ", vault.oneDayApy);
              apyFields.unshift({
                name: "24h",
                value: vault.oneDayApy,
                inline: true,
              });
              // console.log("apy fields ", apyFields);
            }
          } else {
            apyFields = [{ name: "--", value: "Historic APY not available" }];
            console.log("no historic data");
          }
          const vaultEmbedMsg = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(vault.name + "  (" + vault.symbol + ")     " + apy)
            .setDescription(
              "PRICE  `" +
                price +
                "` \n PPS  `" +
                pricePerShare +
                "` \n" +
                tvl +
                " \n STRATS  `" +
                vault.strategies +
                "`"
            )
            .setThumbnail(vault.icon)
            .addFields(apyFields)
            .addField("\u200B", footerText);
          // console.log("vault embed msg: ", vaultEmbedMsg);
          message.reply({ embeds: [vaultEmbedMsg] });
        });
      } catch (error) {
        console.log(error);
        message.reply("Could not find that vault friend.");
      }
    }
    //}
  });
  client.login(process.env.BOT_KEY);
}
// const removeDuplicates = (duplicates) => {
//   let flag = {};
//   let unique = [];

//   duplicates.forEach((elem) => {
//     if (flag[elem.symbol]) {
//       unique.push(elem.symbol);
//     } else {
//       flag[elem.symbol] = true;
//     }
//   });
//   return unique;
// };

function compareVersion(v1, v2) {
  if (typeof v1 !== "string") return false;
  if (typeof v2 !== "string") return false;
  v1 = v1.split(".");
  v2 = v2.split(".");
  const k = Math.min(v1.length, v2.length);
  for (let i = 0; i < k; ++i) {
    v1[i] = parseInt(v1[i], 10);
    v2[i] = parseInt(v2[i], 10);
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return v1.length == v2.length ? 0 : v1.length < v2.length ? -1 : 1;
}
function vaultObjectify(vault) {
  let vaultObject = {};
  if (vault.apy.points === null) {
    vaultObject.historicData = null;
  } else {
    vaultObject = {
      weekAgo: vault.apy.points.week_ago,
      monthAgo: vault.apy.points.month_ago,
      allTime: vault.apy.points.inception,
    };
  }

  vaultObjectComplete = {
    ...vaultObject,
    name: vault.display_name,
    symbol: vault.symbol,
    icon: vault.icon,
    apy: vault.apy.net_apy,
    tvl: vault.tvl.tvl,
    address: vault.address,
    tokenAddress: vault.token.address,
    strategies: vault.strategies.length,
    price: vault.tvl.price,
    pps: vault.pps,
  };
  return vaultObjectComplete;
}
async function fetchApi(network) {
  try {
    let jsonURL = "https://api.yearn.finance/";
    let uriPath = "";
    if (network === 250 || network === 1 || network === 42161) {
      uriPath = "v1/chains/" + network + "/vaults/all";
    } else {
      return 0;
    }
    let call = await fetch(jsonURL + uriPath);
    let result = await call.json();
    return result;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

async function findNewestVault(vault, network) {
  if (vault.length === 0) {
    console.log("could not find that vault - ", vault);
    return 0;
  } else if (vault.length === 1) {
    vault = vault[0];
    return vault;
  } else {
    // FILTER for newest vault version
    var newestVault = { version: "0.0.0" };
    if (vault.length > 1) {
      for (var i = 0; i < vault.length; i++) {
        if (compareVersion(vault[i].version, newestVault.version) === 1) {
          newestVault = vault[i];
        }
      }
    }
    return newestVault;
  }
}

async function getStrategyNames(vault, network) {
  try {
    let vaultFetch = await fetchApi(network);
    console.log("vault.toLowerCase()", vault.toLowerCase());
    let vaultFiltered = vaultFetch.filter(
      (x) => x.symbol.toLowerCase() === vault.toLowerCase()
    );
    // console.log("vault filtered: ", vaultFiltered);

    let vaultNewest = await findNewestVault(vaultFiltered, network);
    let vaultAddress = vaultNewest.address;

    let jsonResult = {};
    let explorer = "https://etherscan.io/address/";
    if (network === 250) {
      explorer = "https://ftmscan.com/address/";
    }
    if (network === 42161) {
      explorer = "https://arbiscan.io/address";
    }
    let strategyApi =
      "https://cache.yearn.finance/v1/chains/" +
      network +
      "/strategies/metadata/get";
    try {
      let call = await fetch(strategyApi);
      jsonResult = await call.json();
      // let vaultExample = jsonResult.filter(x => {return x.vaultAddress === vaultAddress});
      // console.log("vaultAddress", vaultAddress);
      // console.log("jsonresult",jsonResult)
      let vaultExample = jsonResult.find(
        (x) => x.vaultAddress === vaultAddress
      );
      let stratString = "";
      let count = 1;
      vaultExample.strategiesMetadata.forEach((x) => {
        stratString +=
          "[" +
          count +
          "]    [" +
          x.name +
          "](" +
          explorer +
          x.address +
          ") - " +
          x.description +
          "\n \n";
        count += 1;
      });
      return stratString;
    } catch (error) {
      console.log(error);
      return 0;
    }
  } catch (error) {
    console.log(error);
    return 0;
  }
}

// not being used - only gets description, not name -> consolidatd to getStrategyNames()
// async function getStrategyDescription(vault, network) {
//   let vaultFetch = await fetchApi(1);
//   let vaultExample = vaultFetch.filter((x) => x.symbol === vault);

//   let vaultFiltered = await findNewestVault(vaultExample, network);
//   let vaultAddress = vaultFiltered.address;

//   let jsonResult = {};
//   let strategyApi =
//     "https://cache.yearn.finance/v1/chains/1/strategies/metadata/get";
//   try {
//     let call = await fetch(strategyApi);
//     jsonResult = await call.json();
//     // let vaultExample = jsonResult.filter(x => {return x.vaultAddress === vaultAddress});
//     let vaultExample = jsonResult.find(x => x.vaultAddress === vaultAddress);
//     let stratString = ""

//     vaultExample.strategiesMetadata.forEach(x=>stratString += " \  \ \ " + x.description + " \n \n")
//     return stratString
//   } catch (error) {
//     console.log(error);
//     return 0;
//   }
// }
async function getVaultData(vault, network) {
  let jsonResult = {};
  try {
    jsonResult = await fetchApi(network);
  } catch (error) {
    console.log(error);
    return 0;
  }

  let vaultFiltered = jsonResult.filter(
    (x) => x.symbol.toLowerCase() === vault.toLowerCase()
  );
  let newestVault = {};
  newestVault = await findNewestVault(vaultFiltered, network);
  // console.log("new vault: ", newestVault);
  let pricePerShare = await getPricePerShare(newestVault.address, network);

  newestVault.pps = pricePerShare.toFixed(4);
  let vaultReturn = vaultObjectify(newestVault);
  if (network === 250) {
    let oneDayAgo = await oneDayAgoPrice(vaultReturn.address);
    let oneDayAgoTime = oneDayAgo.timestamp;

    let nowTime = Date.now();
    let oneDayAgoActual = nowTime - 60 * 60 * 24 * 1000;
    let oneDay = oneDayAgoTime / oneDayAgoActual;
    let annualized = oneDay * 365;
    let priceChange = parseFloat(pricePerShare) - parseFloat(oneDayAgo.price);
    let oneDayApr = (priceChange / pricePerShare) * annualized;
    oneDayApr = oneDayApr * 100;
    // console.log(
    //   "price change ",
    //   priceChange,
    //   " pricepreshare ",
    //   pricePerShare,
    //   " one day ago price ",
    //   oneDayAgo.price
    // );
    let oneDayApy = aprToApy(oneDayApr);
    oneDayApy = oneDayApy / 100;

    vaultReturn.oneDayApy = apyFormat(oneDayApy) + "%";
  }

  return vaultReturn;
}

async function getVaultDataVision(vault, network) {
  let jsonResult = {};
  try {
    jsonResult = await fetchApi(network);
  } catch (error) {
    console.log(error);
    return 0;
  }

  let vaultFiltered = jsonResult.filter(
    (x) => x.symbol.toLowerCase() === vault.toLowerCase()
  );
  let newestVault = {};
  newestVault = await findNewestVault(vaultFiltered, network);
  // console.log("new vault: ", newestVault);
  let pricePerShare = await getPricePerShare(newestVault.address, network);

  newestVault.pps = pricePerShare.toFixed(4);
  let vaultReturn = vaultObjectify(newestVault);

  // let oneDayAgo = await oneDayAgoPrice(vaultReturn.address);
  let historical = await historicalPrice(vaultReturn.address, network);
  let oneDayAgoTime = historical.oneDayAgo.timestamp;
  let sevenDayAgoTime = historical.sevenDayAgo.timestamp;
  let thirtyDayAgoTime = historical.thirtyDayAgo.timestamp;

  let nowTime = Date.now();
  let oneDayAgoActual = nowTime - 60 * 60 * 24 * 1000;
  let sevenDayAgoActual = nowTime - 60 * 60 * 24 * 1000 * 7;
  let thirtyDayAgoActual = nowTime - 60 * 60 * 24 * 1000 * 30;
  let oneDay = oneDayAgoTime / oneDayAgoActual;
  let sevenDay = sevenDayAgoTime / sevenDayAgoActual;
  let thirtyDay = thirtyDayAgoTime / thirtyDayAgoActual;

  let annualized = oneDay * 365;
  let annualizedSevenDay = sevenDay * (365 / 7);
  let annualizedThirtyDay = thirtyDay * (365 / 30);
  let priceChange =
    parseFloat(pricePerShare) - parseFloat(historical.oneDayAgo.price);
  let priceChangeSevenDay =
    parseFloat(pricePerShare) - parseFloat(historical.sevenDayAgo.price);
  let priceChangeThirtyDay =
    parseFloat(pricePerShare) - parseFloat(historical.thirtyDayAgo.price);

  let oneDayApr = (priceChange / pricePerShare) * annualized;
  let sevenDayApr = (priceChangeSevenDay / pricePerShare) * annualizedSevenDay;
  let thirtyDayApr =
    (priceChangeThirtyDay / pricePerShare) * annualizedThirtyDay;

  oneDayApr = oneDayApr * 100;
  sevenDayApr = sevenDayApr * 100;
  thirtyDayApr = thirtyDayApr * 100;
  console.log(
    "price change ",
    priceChange,
    " pricepreshare ",
    pricePerShare,
    " one day ago price ",
    historical.oneDayAgo.price
  );
  let oneDayApy = aprToApy(oneDayApr);
  let sevenDayApy = aprToApy(sevenDayApr);
  let thirtyDayApy = aprToApy(thirtyDayApr);
  oneDayApy = oneDayApy / 100;
  sevenDayApy = sevenDayApy / 100;
  thirtyDayApy = thirtyDayApy / 100;

  vaultReturn.oneDayApy = apyFormat(oneDayApy) + "%";
  vaultReturn.sevenDayApy = apyFormat(sevenDayApy) + "%";
  vaultReturn.thirtyDayApy = apyFormat(thirtyDayApy) + "%";

  return vaultReturn;
}

async function runTest() {
  let test = {};
  try {
    let apiAzureUrl =
      "https://yearnapybot.azurewebsites.net/api/chains/250/vaults/0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7/pps/1d";
    let apiAzure = await fetch(apiAzureUrl);
    apiAzure = await apiAzure.json();
    test.azure = apiAzure.timestamps[0];
  } catch (error) {
    console.log("azure API fail -------------------------", error);
    test.azure = 0;
  }
  try {
    const mimAddress = "0x0A0b23D9786963DE69CB2447dC125c49929419d8";

    const mimContract = new ethers.Contract(
      mimAddress,
      vaultAbi,
      fantomProvider
    );

    let decimals = await mimContract.decimals();
    let pricePerShare = await mimContract.pricePerShare();
    test.mim = ethers.utils.formatUnits(pricePerShare, decimals);
  } catch (error) {
    console.log("RPC fail -----------------------", error);
    test.mim = 0;
  }
  return test;
}
async function getVaultApy(vault, network) {
  let jsonResult = {};
  try {
    jsonResult = await fetchApi(network);
  } catch (error) {
    console.log(error);
    return 0;
  }

  let vaultFiltered = jsonResult.filter(
    (x) => x.symbol.toLowerCase() === vault.toLowerCase()
  );
  let newestVault = {};
  newestVault = await findNewestVault(vaultFiltered, network);

  let pricePerShare = await getPricePerShare(newestVault.address, network);

  newestVault.pps = pricePerShare.toFixed(4);
  let vaultReturn = vaultObjectify(newestVault);
  if (network === 250) {
    let oneDayAgo = await oneDayAgoPrice(vaultReturn.address);
    let oneDayAgoTime = oneDayAgo.timestamp;

    let nowTime = Date.now();
    let oneDayAgoActual = nowTime - 60 * 60 * 24 * 1000;
    let oneDay = oneDayAgoTime / oneDayAgoActual;
    let annualized = oneDay * 365;
    let priceChange = parseFloat(pricePerShare) - parseFloat(oneDayAgo.price);
    let oneDayApr = (priceChange / pricePerShare) * annualized;
    oneDayApr = oneDayApr * 100;
    // console.log(
    //   "price change ",
    //   priceChange,
    //   " pricepreshare ",
    //   pricePerShare,
    //   " one day ago price ",
    //   oneDayAgo.price
    // );

    let oneDayApy = aprToApy(oneDayApr);
    oneDayApy = oneDayApy / 100;
    vaultReturn.oneDayApy = apyFormat(oneDayApy) + "%";
  }

  return vaultReturn;
}

run();
