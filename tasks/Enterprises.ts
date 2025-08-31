import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy:local", "Despliega el contrato Enterprises_Contracts en red local").setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    console.log("🚀 Desplegando en red local...");

    // Iniciar nodo local si no está corriendo
    try {
      await hre.run("node");
    } catch (error) {
      console.log("Nodo local ya está corriendo o no se pudo iniciar");
    }

    // Desplegar en localhost
    await hre.run("deploy", { tags: "Enterprises_Contracts" });
  },
);

task("deploy:sepolia", "Despliega el contrato Enterprises_Contracts en Sepolia con verificación").setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    console.log("🚀 Desplegando en Sepolia...");

    // Verificar que tenemos las variables de entorno necesarias
    const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

    if (!sepoliaRpcUrl) {
      throw new Error("❌ SEPOLIA_RPC_URL no está configurado en las variables de entorno");
    }

    if (!etherscanApiKey) {
      throw new Error("❌ ETHERSCAN_API_KEY no está configurado en las variables de entorno");
    }

    // Desplegar en Sepolia
    await hre.run("deploy", { tags: "Enterprises_Contracts" });
  },
);

task("accounts", "Muestra las cuentas configuradas").setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const { employer, customer, user } = await hre.getNamedAccounts();

  console.log("👥 Cuentas configuradas:");
  console.log(`   Employer: ${employer}`);
  console.log(`   Customer: ${customer}`);
  console.log(`   User: ${user}`);

  // Mostrar balances si estamos en una red con fondos
  const network = hre.network;
  if (network.name !== "hardhat") {
    const provider = hre.ethers.provider;

    const employerBalance = await provider.getBalance(employer);
    const customerBalance = await provider.getBalance(customer);
    const userBalance = await provider.getBalance(user);

    console.log("\n💰 Balances:");
    console.log(`   Employer: ${hre.ethers.formatEther(employerBalance)} ETH`);
    console.log(`   Customer: ${hre.ethers.formatEther(customerBalance)} ETH`);
    console.log(`   User: ${hre.ethers.formatEther(userBalance)} ETH`);
  }
});

task("verify:enterprises", "Verifica el contrato Enterprises_Contracts en Etherscan")
  .addParam("address", "Dirección del contrato a verificar")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    console.log(`🔍 Verificando contrato en ${taskArgs.address}...`);

    try {
      await hre.run("verify:verify", {
        address: taskArgs.address,
        constructorArguments: [],
        contract: "contracts/Enterprises_Contracts.sol:Enterprises_Contracts",
      });
      console.log("✅ Contrato verificado exitosamente en Etherscan");
    } catch (error) {
      console.log("⚠️ Error durante la verificación:", error);
    }
  });
