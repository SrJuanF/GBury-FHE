import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { Enterprises_Contracts } from "../typechain-types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import {
  setContractInstance,
  setStepCounters,
  progress,
  executeWithOracleWait,
  createEncryptedAddresses,
  decryptEuint8,
  decryptEuint64,
  decryptEbool,
  createContractSimple,
  signContractSimple,
  retreatContractSimple,
  wait,
  getNonSigner,
  expectTransactionToFail,
  getContractData,
} from "./hook";

type Signers = {
  employer: HardhatEthersSigner;
  customer: HardhatEthersSigner;
  user: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

describe("Enterprises_Contracts_Sepolia", function () {
  let signers: Signers;
  let enterprisesContractsContract: Enterprises_Contracts;
  let enterprisesContractsContractAddress: string;
  let contractId: number;
  let latestRequestId: bigint;
  let exampleHash: string;
  let encryptedAddr: any; // Variable global para direcciones encriptadas

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const EnterpriseContractsDeployement = await deployments.get("Enterprises_Contracts");
      enterprisesContractsContractAddress = EnterpriseContractsDeployement.address;
      enterprisesContractsContract = (await ethers.getContractAt(
        "Enterprises_Contracts",
        EnterpriseContractsDeployement.address,
      )) as unknown as Enterprises_Contracts;

      // Set contract instance in hook
      setContractInstance(enterprisesContractsContract, enterprisesContractsContractAddress);
    } catch (e) {
      if (e instanceof Error) {
        e.message += ". Call 'npx hardhat deploy --network sepolia'";
      }
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      employer: ethSigners[0],
      customer: ethSigners[1],
      user: ethSigners[2],
      emptSigner: ethSigners[3],
    };

    // Example hash for testing
    exampleHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    // Create encrypted addresses for all tests
    encryptedAddr = await createEncryptedAddresses(
      [signers.employer.address, signers.customer.address, signers.user.address, ethers.ZeroAddress],
      signers.employer,
    );
    progress("Encrypted addresses created successfully for all tests");
  });

  beforeEach(async () => {
    // Reset step counters
    setStepCounters(0, 0);

    // Pausa breve entre tests para evitar conflictos de estado
    await wait(2000);
  });

  describe("Create Contract", function () {
    it("Should create a contract successfully with all signers", async () => {
      setStepCounters(0, 8);
      this.timeout(120000); // 2 minutos para manejar delays de oráculo

      //Create contract
      const {
        requestId,
        contractId: newContractId,
        tx,
      } = await createContractSimple(
        exampleHash,
        "Test Contract Sepolia",
        "This is a test contract description for Sepolia",
        "Employment",
        encryptedAddr,
      );

      // Usar los valores obtenidos
      contractId = newContractId;
      latestRequestId = requestId;

      await wait(20_000);

      // Verify contract details after oracle processing
      const contractData = await enterprisesContractsContract.connect(signers.employer).getContract(contractId);

      expect(contractData.title).to.equal("Test Contract Sepolia");
      expect(contractData.description).to.equal("This is a test contract description for Sepolia");
      expect(contractData.typeDoc).to.equal("Employment");
      expect(contractData.hashdoc).to.equal(exampleHash);

      // Decrypt and verify encrypted values
      const clearCreatedAt = await decryptEuint64(contractData.createdAt, signers.employer);
      const clearUpdatedAt = await decryptEuint64(contractData.updatedAt, signers.employer);
      const clearIsActive = await decryptEbool(contractData.isActive, signers.employer);
      const clearRequiredSignatures = await decryptEuint8(contractData.requiredSignatures, signers.employer);
      const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signers.employer);

      expect(clearCreatedAt).to.be.greaterThan(0n);
      expect(clearUpdatedAt).to.be.greaterThan(0n);
      expect(clearIsActive).to.be.false;
      expect(clearRequiredSignatures).to.equal(3n); // 3 signers válidos
      expect(clearCurrentSignatures).to.equal(0n); // Sin firmas aún

      progress("Contract creation test completed successfully");
    });

    it("Should fail when creating contract with empty data", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      // Use global encrypted addresses for this test too

      progress("Attempting to create contract with empty title...");
      await expectTransactionToFail(
        enterprisesContractsContract.createContract(
          exampleHash,
          "", // Empty title
          "Description",
          "Type",
          encryptedAddr.handles[0],
          encryptedAddr.handles[1],
          encryptedAddr.handles[2],
          encryptedAddr.handles[3],
          encryptedAddr.inputProof,
        ),
        "ContractDataEmpty",
      );

      progress("Empty data validation test passed");
    });
  });

  describe("Sign Contract", function () {
    beforeEach(async function () {
      this.timeout(120000);
      // Create a contract first using global encrypted addresses
      const { contractId: newContractId } = await createContractSimple(
        exampleHash,
        "Test Contract for Signing Sepolia",
        "This is a test contract for signing on Sepolia",
        "Employment",
        encryptedAddr,
      );

      contractId = newContractId;

      progress(`Contract ${contractId} created and ready for signing tests`);
    });

    it("Should allow employer to sign the contract", async () => {
      setStepCounters(0, 6);
      this.timeout(120000);

      // Use the simplified function
      await signContractSimple(contractId, signers.employer, "Employer");

      // Verify the signature was recorded
      const contractData = await enterprisesContractsContract.connect(signers.employer).getContract(contractId);
      const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signers.employer);
      expect(clearCurrentSignatures).to.equal(1n);
      progress("Signature verification completed");
    });

    it("Should allow multiple signers to sign the contract", async () => {
      setStepCounters(0, 9);
      this.timeout(180000); // 3 minutos para múltiples firmas

      // Sign with each signer using the dedicated function
      await signContractSimple(contractId, signers.employer, "Employer");
      await signContractSimple(contractId, signers.customer, "Customer");
      await signContractSimple(contractId, signers.user, "User");

      // Final verification that contract is active
      const contractData = await enterprisesContractsContract.connect(signers.user).getContract(contractId);
      const clearIsActive = await decryptEbool(contractData.isActive, signers.user);
      expect(clearIsActive).to.be.true;
      progress("Contract activation verified");
    });

    it("Should fail when non-signer tries to sign", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Attempting to sign with non-signer account...");

      await expectTransactionToFail(
        enterprisesContractsContract.connect(signers.emptSigner).signContract(contractId),
        "SignerNotAllowed",
      );

      progress("Non-signer validation test passed");
    });
  });

  describe("Retreat Contract", function () {
    beforeEach(async function () {
      this.timeout(120000);

      progress("Setting up contract for retreat tests using global encrypted addresses...");

      // Create a contract first using global encrypted addresses

      const { contractId: newContractId } = await createContractSimple(
        exampleHash,
        "Test Contract for Retreat Sepolia",
        "This is a test contract for retreating on Sepolia",
        "Employment",
        encryptedAddr,
      );

      contractId = newContractId;

      progress(`Contract ${contractId} created and ready for retreat tests`);
    });

    it("Should allow signer to retreat from contract", async () => {
      setStepCounters(0, 6);
      this.timeout(120000);

      // Use the simplified function
      await retreatContractSimple(contractId, signers.employer, "Employer");

      // Verify retreat was recorded
      const contractData = await enterprisesContractsContract.connect(signers.employer).getContract(contractId);
      const clearRetreatedSignatures = await decryptEuint8(contractData.currentSignaturesRetreated, signers.employer);
      expect(clearRetreatedSignatures).to.equal(1n);
      progress("Retreat verification completed");
    });

    it("Should deactivate contract when all signers retreat", async () => {
      setStepCounters(0, 9);
      this.timeout(180000); // 3 minutos para múltiples retiros

      // All signers retreat using the dedicated function
      await retreatContractSimple(contractId, signers.employer, "Employer");
      await retreatContractSimple(contractId, signers.customer, "Customer");
      await retreatContractSimple(contractId, signers.user, "User");

      // Final verification that contract is deactivated
      const contractData = await enterprisesContractsContract.connect(signers.customer).getContract(contractId);
      const clearIsActive = await decryptEbool(contractData.isActive, signers.customer);
      expect(clearIsActive).to.be.false;
      progress("Contract deactivation verified");
    });

    it("Should fail when non-signer tries to retreat", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Attempting to retreat with non-signer account...");

      await expectTransactionToFail(
        enterprisesContractsContract.connect(signers.emptSigner).retreatContract(contractId),
        "SignerNotAllowed",
      );

      progress("Non-signer retreat validation test passed");
    });
  });

  describe("Getters", function () {
    beforeEach(async function () {
      this.timeout(120000);

      progress("Setting up contract for getter tests using global encrypted addresses...");

      // Create a contract for testing getters using global encrypted addresses

      const { contractId: newContractId } = await createContractSimple(
        exampleHash,
        "Test Contract for Getters Sepolia",
        "This is a test contract for testing getters on Sepolia",
        "Employment",
        encryptedAddr,
      );

      contractId = newContractId;

      progress(`Contract ${contractId} created and ready for getter tests`);
    });

    it("Should get contract signers", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Getting contract signers...");
      const contractSigners = await enterprisesContractsContract
        .connect(signers.employer)
        .getContractSigners(contractId);

      expect(contractSigners).to.have.length(4);
      progress("Contract signers retrieved successfully");
    });

    it("Should get contract details", async () => {
      setStepCounters(0, 8);
      this.timeout(90000);

      progress("Getting contract details...");
      const contractData = await enterprisesContractsContract.connect(signers.employer).getContract(contractId);

      expect(contractData.title).to.equal("Test Contract for Getters Sepolia");
      expect(contractData.description).to.equal("This is a test contract for testing getters on Sepolia");
      expect(contractData.typeDoc).to.equal("Employment");
      expect(contractData.hashdoc).to.equal(exampleHash);
      progress("Basic contract data verified");

      // Decrypt encrypted values
      const clearCreatedAt = await decryptEuint64(contractData.createdAt, signers.employer);
      const clearUpdatedAt = await decryptEuint64(contractData.updatedAt, signers.employer);
      const clearIsActive = await decryptEbool(contractData.isActive, signers.employer);
      const clearRequiredSignatures = await decryptEuint8(contractData.requiredSignatures, signers.employer);
      const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signers.employer);
      const clearRetreatedSignatures = await decryptEuint8(contractData.currentSignaturesRetreated, signers.employer);

      expect(clearCreatedAt).to.be.greaterThan(0n);
      expect(clearUpdatedAt).to.be.greaterThan(0n);
      expect(clearIsActive).to.be.false;
      expect(clearRequiredSignatures).to.equal(3n);
      expect(clearCurrentSignatures).to.equal(0n);
      expect(clearRetreatedSignatures).to.equal(0n);
      progress("Encrypted contract data verified");
    });

    it("Should get signer contracts", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Getting signer contracts...");
      const signerContracts = await enterprisesContractsContract.connect(signers.employer).getSignerContracts();

      // The signer should have at least one contract
      expect(signerContracts.length).to.be.greaterThan(0);
      progress("Signer contracts retrieved successfully");
    });

    it("Should get contract counter", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Getting contract counter...");
      const contractCounter = await enterprisesContractsContract.getContractCounter();
      expect(contractCounter).to.be.greaterThan(0n);
      progress(`Contract counter: ${contractCounter}`);
    });

    it("Should get last request", async () => {
      setStepCounters(0, 4);
      this.timeout(60000);

      progress("Getting last request...");
      const lastRequest = await enterprisesContractsContract.getLastRequest();

      //expect(lastRequest.isDecryptionPending).to.be.false;
      expect(lastRequest.latestRequestId).to.be.greaterThan(0n);
      expect(lastRequest.contractId).to.equal(contractId);
      progress("Last request data verified");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete contract lifecycle", async () => {
      setStepCounters(0, 15);
      this.timeout(300000); // 5 minutos para el ciclo completo

      progress("Starting complete contract lifecycle test...");

      // 1. Create contract using global encrypted addresses

      const { contractId: lifecycleContractId } = await createContractSimple(
        exampleHash,
        "Lifecycle Test Contract Sepolia",
        "Testing complete contract lifecycle on Sepolia",
        "Employment",
        encryptedAddr,
      );
      progress(`Lifecycle contract ID: ${lifecycleContractId}`);

      progress("Contract creation oracle processing completed");

      // 2. Sign contract using dedicated functions
      await signContractSimple(lifecycleContractId, signers.employer, "Employer");
      await signContractSimple(lifecycleContractId, signers.customer, "Customer");
      await signContractSimple(lifecycleContractId, signers.user, "User");

      // 5. Verify contract is active
      let contractData = await enterprisesContractsContract.connect(signers.employer).getContract(lifecycleContractId);

      const clearIsActive = await decryptEbool(contractData.isActive, signers.employer);
      expect(clearIsActive).to.be.true;
      progress("Contract activation verified");

      // 6. Retreat from contract using dedicated function
      await retreatContractSimple(lifecycleContractId, signers.employer, "Employer");

      // 7. Verify retreat was recorded
      contractData = await enterprisesContractsContract.connect(signers.employer).getContract(lifecycleContractId);

      const clearRetreatedSignatures = await decryptEuint8(contractData.currentSignaturesRetreated, signers.employer);
      expect(clearRetreatedSignatures).to.equal(1n);
      progress("Retreat verification completed");
    });

    it("Should handle multiple contracts simultaneously", async () => {
      setStepCounters(0, 12);
      this.timeout(240000); // 4 minutos para múltiples contratos

      progress("Creating multiple contracts simultaneously...");

      // Create first contract with specific signers
      const encryptedAddr1 = await createEncryptedAddresses(
        [signers.employer.address, signers.customer.address, ethers.ZeroAddress, ethers.ZeroAddress],
        signers.employer,
      );

      const { contractId: contractId1 } = await createContractSimple(
        exampleHash,
        "First Contract Sepolia",
        "First contract for simultaneous testing",
        "Employment",
        encryptedAddr1,
      );
      progress(`First contract ID: ${contractId1}`);

      // Create second contract with different signers
      const encryptedAddr2 = await createEncryptedAddresses(
        [signers.customer.address, signers.user.address, ethers.ZeroAddress, ethers.ZeroAddress],
        signers.employer,
      );

      const { contractId: contractId2 } = await createContractSimple(
        exampleHash,
        "Second Contract Sepolia",
        "Second contract for simultaneous testing",
        "Partnership",
        encryptedAddr2,
      );
      progress(`Second contract ID: ${contractId2}`);

      // Verify both contracts exist and are different
      expect(contractId1).to.not.equal(contractId2);

      // Test signing on both contracts using dedicated functions
      progress("Signing first contract...");
      await signContractSimple(contractId1, signers.customer, "Customer");
      await signContractSimple(contractId1, signers.employer, "Employer");

      progress("Signing second contract...");
      await signContractSimple(contractId2, signers.customer, "Customer");
      await signContractSimple(contractId2, signers.user, "User");

      const contractData1 = await enterprisesContractsContract.connect(signers.customer).getContract(contractId1);
      const contractData2 = await enterprisesContractsContract.connect(signers.user).getContract(contractId2);

      // Verify both contracts are active
      const clearIsActive1 = await decryptEbool(contractData1.isActive, signers.customer);
      const clearIsActive2 = await decryptEbool(contractData2.isActive, signers.user);

      expect(contractData1.title).to.equal("First Contract Sepolia");
      expect(contractData2.title).to.equal("Second Contract Sepolia");
      progress("Multiple contracts created and verified successfully");

      expect(clearIsActive1).to.be.true;
      expect(clearIsActive2).to.be.true;
      progress("Multiple contracts signed and activated successfully");
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle invalid contract ID", async () => {
      setStepCounters(0, 3);
      this.timeout(60000);

      progress("Testing invalid contract ID...");
      const invalidContractId = 99999;

      await expectTransactionToFail(
        enterprisesContractsContract.connect(signers.employer).signContract(invalidContractId),
        "SignerNotAllowed",
      );

      progress("Invalid contract ID handling verified");
    });

    it("Should handle repeated signing attempts", async () => {
      setStepCounters(0, 8);
      this.timeout(120000);

      progress("Setting up contract for repeated signing test...");

      // Create a contract using global encrypted addresses

      const { contractId: testContractId } = await createContractSimple(
        exampleHash,
        "Repeated Signing Test",
        "Testing repeated signing attempts",
        "Employment",
        encryptedAddr,
      );

      // First signing
      progress("First signing attempt...");
      await signContractSimple(testContractId, signers.employer, "Employer");

      // Second signing attempt (should not increase signature count)
      progress("Second signing attempt (should not increase count)...");
      await signContractSimple(testContractId, signers.employer, "Employer");

      // Verify signature count is still 1
      const contractData = await enterprisesContractsContract.connect(signers.employer).getContract(testContractId);

      const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signers.employer);
      expect(clearCurrentSignatures).to.equal(1n);
      progress("Repeated signing handling verified");
    });

    it("Should handle contract with only one signer", async () => {
      setStepCounters(0, 6);
      this.timeout(120000);

      progress("Creating contract with only one signer...");

      // Create contract with only one signer (different from global)
      const encryptedAddrr = await createEncryptedAddresses(
        [signers.employer.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
        signers.employer,
      );

      const { contractId: singleSignerContractId } = await createContractSimple(
        exampleHash,
        "Single Signer Contract",
        "Contract with only one signer",
        "Personal",
        encryptedAddrr,
      );

      // Sign the contract using dedicated function
      progress("Signing single signer contract...");
      await signContractSimple(singleSignerContractId, signers.employer, "Employer");

      // Verify contract is active
      const contractData = await enterprisesContractsContract
        .connect(signers.employer)
        .getContract(singleSignerContractId);

      const clearIsActive = await decryptEbool(contractData.isActive, signers.employer);
      const clearRequiredSignatures = await decryptEuint8(contractData.requiredSignatures, signers.employer);
      const clearCurrentSignatures = await decryptEuint8(contractData.currentSignatures, signers.employer);

      expect(clearIsActive).to.be.true;
      expect(clearRequiredSignatures).to.equal(1n);
      expect(clearCurrentSignatures).to.equal(1n);
      progress("Single signer contract handling verified");
    });
  });
});
