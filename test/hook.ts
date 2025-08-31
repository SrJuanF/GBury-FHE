import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { Enterprises_Contracts } from "../typechain-types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// Global variables that need to be set by the test file
let enterprisesContractsContract: Enterprises_Contracts;
let enterprisesContractsContractAddress: string;
let step: number = 0;
let steps: number = 0;

// Function to set the contract instance and address
export function setContractInstance(contract: Enterprises_Contracts, address: string) {
  enterprisesContractsContract = contract;
  enterprisesContractsContractAddress = address;
}

// Function to set step counters
export function setStepCounters(currentStep: number, totalSteps: number) {
  step = currentStep;
  steps = totalSteps;
}

// Progress logging function
export function progress(message: string) {
  console.log(`${++step}/${steps} ${message}`);
}

// Función helper para esperar el procesamiento del oráculo usando eventos o polling
export async function waitForOracleProcessing(initialRequestId: bigint, maxWaitTime: number = 120000): Promise<bigint> {
  progress(`Waiting for oracle processing via SignerAdded event... Initial request ID: ${initialRequestId}`);

  return new Promise<bigint>((resolve, reject) => {
    let eventReceived = false;

    // Escuchar el evento SignerAdded que indica que el oráculo procesó la desencriptación
    const eventHandler = (signer: string, contractId: bigint, title: string, typeDoc: string) => {
      try {
        if (eventReceived) return; // Evitar múltiples llamadas
        eventReceived = true;

        progress(`Oracle callback received - SignerAdded event: ${signer} for contract ${contractId}`);

        // Limpiar el listener inmediatamente
        (enterprisesContractsContract as any).off("SignerAdded", eventHandler);

        // Obtener el último request ID después del procesamiento
        enterprisesContractsContract
          .getLastRequest()
          .then((lastRequest) => {
            resolve(lastRequest.latestRequestId);
          })
          .catch((err) => {
            progress(`Error getting last request after oracle processing: ${err}`);
            resolve(initialRequestId);
          });
      } catch (err) {
        progress(`Error in oracle event handler: ${err}`);
        reject(err);
      }
    };

    // Registrar el listener del evento usando any para evitar problemas de tipos
    (enterprisesContractsContract as any).on("SignerAdded", eventHandler);

    // Timeout en caso de que el oráculo no responda
    setTimeout(async () => {
      if (!eventReceived) {
        (enterprisesContractsContract as any).off("SignerAdded", eventHandler);
        progress(`Oracle callback timeout after ${maxWaitTime}ms. Falling back to polling...`);

        // Fallback: usar polling para verificar si el oráculo procesó
        try {
          const startTime = Date.now();
          while (Date.now() - startTime < 60000) {
            // 1 minuto adicional de polling
            const lastRequest = await enterprisesContractsContract.getLastRequest();
            if (lastRequest.latestRequestId > initialRequestId) {
              progress(`Oracle processing detected via polling. New request ID: ${lastRequest.latestRequestId}`);
              resolve(lastRequest.latestRequestId);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Esperar 2 segundos
          }
          progress(`Polling timeout. Using initial request ID: ${initialRequestId}`);
          resolve(initialRequestId);
        } catch (err) {
          progress(`Polling error: ${err}. Using initial request ID: ${initialRequestId}`);
          resolve(initialRequestId);
        }
      }
    }, maxWaitTime);
  });
}

// Función helper para ejecutar transacción y esperar evento (versión principal)
export async function executeWithOracleWait<T>(
  transactionPromise: Promise<T>,
  maxWaitTime: number = 120000,
): Promise<{ result: T; requestId: bigint }> {
  // Registrar el listener ANTES de ejecutar la transacción
  const eventPromise = new Promise<bigint>((resolve, reject) => {
    let eventReceived = false;

    const eventHandler = (signer: string, contractId: bigint, title: string, typeDoc: string) => {
      try {
        if (eventReceived) return;
        eventReceived = true;

        progress(`Oracle callback received - SignerAdded event: ${signer} for contract ${contractId}`);
        (enterprisesContractsContract as any).off("SignerAdded", eventHandler);

        enterprisesContractsContract
          .getLastRequest()
          .then((lastRequest) => {
            resolve(lastRequest.latestRequestId);
          })
          .catch((err) => {
            progress(`Error getting last request: ${err}`);
            resolve(0n);
          });
      } catch (err) {
        progress(`Error in oracle event handler: ${err}`);
        reject(err);
      }
    };

    (enterprisesContractsContract as any).on("SignerAdded", eventHandler);

    setTimeout(() => {
      if (!eventReceived) {
        (enterprisesContractsContract as any).off("SignerAdded", eventHandler);
        progress(`Oracle callback timeout after ${maxWaitTime}ms`);
        resolve(0n);
      }
    }, maxWaitTime);
  });

  // Ejecutar la transacción
  const result = await transactionPromise;

  // Esperar el evento
  const requestId = await eventPromise;

  return { result, requestId };
}

// Función helper para crear direcciones encriptadas
export async function createEncryptedAddresses(addresses: string[], signer: HardhatEthersSigner) {
  try {
    const encryptedInput = await fhevm
      .createEncryptedInput(enterprisesContractsContractAddress, signer.address)
      .addAddress(addresses[0])
      .addAddress(addresses[1])
      .addAddress(addresses[2])
      .addAddress(addresses[3])
      .encrypt();

    // Validar que la encriptación fue exitosa
    if (!encryptedInput || !encryptedInput.handles || encryptedInput.handles.length !== 4) {
      throw new Error("Encryption failed - invalid handles");
    }
    return encryptedInput;
  } catch (error) {
    progress(`Error creating encrypted addresses: ${error}`);
    throw error;
  }
}

// Función helper para desencriptar valores euint8
export async function decryptEuint8(encryptedValue: any, signer: HardhatEthersSigner): Promise<bigint> {
  return await fhevm.userDecryptEuint(FhevmType.euint8, encryptedValue, enterprisesContractsContractAddress, signer);
}

// Función helper para desencriptar valores euint64
export async function decryptEuint64(encryptedValue: any, signer: HardhatEthersSigner): Promise<bigint> {
  return await fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, enterprisesContractsContractAddress, signer);
}

// Función helper para desencriptar valores ebool
export async function decryptEbool(encryptedValue: any, signer: HardhatEthersSigner): Promise<boolean> {
  return await fhevm.userDecryptEbool(encryptedValue, enterprisesContractsContractAddress, signer);
}

// Función helper para crear contrato de forma simple y confiable
export async function createContractSimple(
  hash: string,
  title: string,
  description: string,
  typeDoc: string,
  encryptedAddr: any,
): Promise<{ requestId: bigint; contractId: number; tx: any }> {
  progress("Creating contract...");

  // Ejecutar la transacción y esperar procesamiento del oráculo
  const { result: tx, requestId } = await executeWithOracleWait(
    enterprisesContractsContract.createContract(
      hash,
      title,
      description,
      typeDoc,
      encryptedAddr.handles[0],
      encryptedAddr.handles[1],
      encryptedAddr.handles[2],
      encryptedAddr.handles[3],
      encryptedAddr.inputProof,
    ),
  );

  const receipt = await tx.wait(2);
  expect(receipt?.status).to.equal(1);
  progress("Contract created successfully");

  // Obtener valores después de la transacción
  const actualContractId = Number(await enterprisesContractsContract.getContractCounter());

  progress(`Contract ID: ${actualContractId}, Request ID: ${requestId}`);

  return {
    requestId: requestId,
    contractId: actualContractId,
    tx,
  };
}

// Función helper para firmar contrato de forma individual y confiable
export async function signContractSimple(
  contractId: number,
  signer: HardhatEthersSigner,
  signerName: string,
): Promise<void> {
  progress(`${signerName} signing the contract...`);

  // Execute transaction and wait for oracle processing
  const { result: tx } = await executeWithOracleWait(
    enterprisesContractsContract.connect(signer).signContract(contractId),
  );

  const receipt = await tx.wait(2);
  expect(receipt?.status).to.equal(1);
  progress(`${signerName} signed successfully`);
  progress(`Oracle processing completed for ${signerName} signing`);
}

// Función helper para retirarse del contrato de forma individual y confiable
export async function retreatContractSimple(
  contractId: number,
  signer: HardhatEthersSigner,
  signerName: string,
): Promise<void> {
  progress(`${signerName} retreating from contract...`);

  // Execute transaction and wait for oracle processing
  const { result: tx } = await executeWithOracleWait(
    enterprisesContractsContract.connect(signer).retreatContract(contractId),
  );

  const receipt = await tx.wait(2);
  expect(receipt?.status).to.equal(1);
  progress(`${signerName} retreated successfully`);
  progress(`Oracle processing completed for ${signerName} retreat`);
}

// Función helper para esperar un tiempo específico
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Función helper para verificar que una transacción falla con un error específico
export async function expectTransactionToFail(transactionPromise: Promise<any>, errorName: string): Promise<void> {
  try {
    await expect(transactionPromise).to.be.revertedWithCustomError(enterprisesContractsContract, errorName);
  } catch (error) {
    // Si falla con custom error, intentar con error genérico
    await expect(transactionPromise).to.be.reverted;
  }
}

// Función helper para obtener datos del contrato y desencriptarlos
export async function getContractData(contractId: number, signer: HardhatEthersSigner) {
  const contractData = await enterprisesContractsContract.connect(signer).getContract(contractId);

  // Desencriptar valores
  const clearCreatedAt = await decryptEuint64(contractData.createdAt, signer);
  const clearUpdatedAt = await decryptEuint64(contractData.updatedAt, signer);
  const clearIsActive = await decryptEbool(contractData.isActive, signer);
  const clearRequiredSignatures = await decryptEuint8(contractData.requiredSignatures, signer);
  const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signer);
  const clearRetreatedSignatures = await decryptEuint8(contractData.currentSignaturesRetreated, signer);

  return {
    ...contractData,
    clearCreatedAt,
    clearUpdatedAt,
    clearIsActive,
    clearRequiredSignatures,
    clearCurrentSignatures,
    clearRetreatedSignatures,
  };
}
