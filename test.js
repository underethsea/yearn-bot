const ethers=require("ethers")

// const rpcPoint = process.env.FANTOM
const rpcPoint = "https://rpc.ftm.tools/"
const fantomProvider = new ethers.providers.JsonRpcProvider(rpcPoint);

const vaultAbi = ["function pricePerShare() public view returns (uint256)","function decimals() public view returns (uint256)"];
const mimAddress = "0x0A0b23D9786963DE69CB2447dC125c49929419d8"

const mimContract = new ethers.Contract(
        mimAddress,
        vaultAbi,
        fantomProvider
      );

async function getPricePerShare() {
let decimals = await mimContract.decimals()
let pricePerShare = await mimContract.pricePerShare()
console.log(ethers.utils.formatUnits(pricePerShare,decimals))
}

getPricePerShare()
