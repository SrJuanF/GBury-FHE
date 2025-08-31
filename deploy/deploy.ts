import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, employer, customer, user } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const { network } = hre;

  console.log("🚀 Iniciando despliegue del contrato Enterprises_Contracts...");
  console.log(`📍 Red: ${network.name}`);
  console.log(`👤 Deployer: ${deployer}`);
  console.log(`👥 Wallets configuradas:`);
  console.log(`   - Employer: ${employer}`);
  console.log(`   - Customer: ${customer}`);
  console.log(`   - User: ${user}`);

  // Desplegar el contrato Enterprises_Contracts
  const deployedEnterprisesContract = await deploy("Enterprises_Contracts", {
    from: deployer,
    log: true,
    waitConfirmations: network.name === "sepolia" ? 6 : 1,
  });

  console.log(`✅ Enterprises_Contracts desplegado en: ${deployedEnterprisesContract.address}`);

  // Verificar el contrato en Etherscan si estamos en Sepolia
  if (network.name === "sepolia" && deployedEnterprisesContract.newlyDeployed) {
    console.log("🔍 Verificando contrato en Etherscan...");

    try {
      await hre.run("verify:verify", {
        address: deployedEnterprisesContract.address,
        constructorArguments: [],
        contract: "contracts/Enterprises_Contracts.sol:Enterprises_Contracts",
      });
      console.log("✅ Contrato verificado exitosamente en Etherscan");
    } catch (error) {
      console.log("⚠️ Error durante la verificación:", error);
      console.log("💡 Puedes verificar manualmente con:");
      console.log(`   npx hardhat verify --network sepolia ${deployedEnterprisesContract.address}`);
    }
  }

  console.log("🎉 Despliegue completado!");
};

export default func;
func.id = "deploy_enterprises_contracts"; // id required to prevent reexecution
func.tags = ["Enterprises_Contracts"];

//https://sepolia.etherscan.io/address/0x2d36E9F9706DF89f6dBCEDc74b76AbFc3Ead447B#code
//https://sepolia.etherscan.io/address/0x13034f18EEa44430Dd9184F78358A9eEb58C6955#code