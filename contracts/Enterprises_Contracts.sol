// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, externalEaddress, externalEuint64, euint64, euint8, eaddress, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

//import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
//import { ConfidentialERC20 } from "./ConfidentialERC20.sol";

contract Enterprises_Contracts is SepoliaConfig, ReentrancyGuard {
    error ContractDataEmpty();
    error InvalidRequestId();
    error SignerNotAllowed();
    //using FHE for *;

    struct Signer {
        //E
        eaddress signer;
        ebool hasSigned;
        ebool retreated;
    }

    struct Contract {
        euint64 id; //E
        string title;
        string description;
        string typeDoc;
        eaddress createdBy; //E
        euint64 createdAt; //E
        euint64 updatedAt; //E
        bytes32 hashDoc;
        ebool isActive; //E
        Signer[4] signers;
        euint8 requiredSignatures; // E,  Num de firmas requeridas
        euint8 currentSignatures; // E
        euint8 currentSignaturesRetreated; // E
    }

    struct Request {
        uint64 contractId;
        bool isDecryptionPending;
        uint256 latestRequestId;
    }

    uint64 private s_contractCounter;
    mapping(uint64 => Contract) private s_contracts;
    mapping(address => euint64[]) private s_signers; //E

    Request private s_LastRequest;

    // Eventos para tracking
    event SignerAdded(address indexed signer, uint64 contractId, string title, string typeDoc);

    constructor() {
        s_contractCounter = 0;
    }

    // ****************************************CREATORS**************************************************
    /**
     * @dev Crea un nuevo contrato - permite hasta 4 firmantes subscritos
     * @param title Título del contrato
     * @param description Descripción del contrato
     * @param typeDoc Tipo de documento
     * @param addr1 Dirección del primer subscrito
     * @param addr2 Dirección del segundo subscrito
     * @param addr3 Dirección del tercer subscrito
     * @param addr4 Dirección del cuarto subscrito
     * @param attestation Atestación de la firma
     */
    function createContract(
        bytes32 _hash,
        string memory title,
        string memory description,
        string memory typeDoc,
        externalEaddress addr1,
        externalEaddress addr2,
        externalEaddress addr3,
        externalEaddress addr4,
        bytes calldata attestation
    ) external nonReentrant returns (uint256, uint64) {
        if (bytes(title).length == 0 || bytes(description).length == 0 || bytes(typeDoc).length == 0)
            revert ContractDataEmpty();

        // Convertir direcciones externas a cifradas
        eaddress addr1Encrypted = FHE.fromExternal(addr1, attestation);
        eaddress addr2Encrypted = FHE.fromExternal(addr2, attestation);
        eaddress addr3Encrypted = FHE.fromExternal(addr3, attestation);
        eaddress addr4Encrypted = FHE.fromExternal(addr4, attestation);
        // Autorizar al contrato
        FHE.allowThis(addr1Encrypted);
        FHE.allowThis(addr2Encrypted);
        FHE.allowThis(addr3Encrypted);
        FHE.allowThis(addr4Encrypted);

        // Incrementar ID cifrado
        s_contractCounter++;
        uint64 contractId = s_contractCounter;


        // Inicializar signers uno por uno
        euint8 signersCount = FHE.asEuint8(0);
        signersCount = _initializeSigner(contractId, 0, addr1Encrypted, signersCount);
        signersCount = _initializeSigner(contractId, 1, addr2Encrypted, signersCount);
        signersCount = _initializeSigner(contractId, 2, addr3Encrypted, signersCount);
        signersCount = _initializeSigner(contractId, 3, addr4Encrypted, signersCount);

        // Configurar datos del contrato
        _setupContractData(contractId, _hash, title, description, typeDoc, signersCount);

        // Configurar permisos
        _setupContractPermissions(contractId);

        // Solicitar desencriptación de signers
        uint256 latestRequestId = requestSigners(
            addr1Encrypted,
            addr2Encrypted,
            addr3Encrypted,
            addr4Encrypted,
            s_contractCounter
        );

        return (latestRequestId, contractId);
    }

    /**
     * @dev Inicializa un signer individual directamente en storage
     */
    function _initializeSigner(
        uint64 contractId,
        uint8 index,
        eaddress signerAddr,
        euint8 signersCount
    ) private returns (euint8) {
        euint8 zero8 = FHE.asEuint8(0);
        euint8 one8 = FHE.asEuint8(1);
        eaddress zeroAddr = FHE.asEaddress(address(0));

        s_contracts[contractId].signers[index] = Signer({
            signer: signerAddr,
            hasSigned: FHE.asEbool(false),
            retreated: FHE.asEbool(false)
        });

        ebool notNull = FHE.ne(signerAddr, zeroAddr);
        euint8 newCount = FHE.add(signersCount, FHE.select(notNull, one8, zero8));

        FHE.allowThis(s_contracts[contractId].signers[index].signer);
        FHE.allowThis(s_contracts[contractId].signers[index].hasSigned);
        FHE.allowThis(s_contracts[contractId].signers[index].retreated);

        return newCount;
    }

    /**
     * @dev Configura los datos básicos del contrato directamente en storage
     */
    function _setupContractData(
        uint64 contractId,
        bytes32 _hash,
        string memory title,
        string memory description,
        string memory typeDoc,
        euint8 signersCount
    ) private {
        s_contracts[contractId].id = FHE.asEuint64(contractId);
        s_contracts[contractId].title = title;
        s_contracts[contractId].description = description;
        s_contracts[contractId].typeDoc = typeDoc;
        s_contracts[contractId].createdBy = FHE.asEaddress(msg.sender);
        s_contracts[contractId].createdAt = FHE.asEuint64(uint64(block.timestamp));
        s_contracts[contractId].updatedAt = s_contracts[contractId].createdAt;
        s_contracts[contractId].hashDoc = _hash;
        s_contracts[contractId].isActive = FHE.asEbool(false);
        s_contracts[contractId].requiredSignatures = signersCount;
        s_contracts[contractId].currentSignatures = FHE.asEuint8(0);
        s_contracts[contractId].currentSignaturesRetreated = FHE.asEuint8(0);
    }

    /**
     * @dev Configura los permisos del contrato directamente en storage
     */
    function _setupContractPermissions(uint64 contractId) private {
        //FHE.allowThis(s_contractCounter);
        FHE.allowThis(s_contracts[contractId].id);
        FHE.allowThis(s_contracts[contractId].createdBy);
        FHE.allowThis(s_contracts[contractId].createdAt);
        FHE.allowThis(s_contracts[contractId].updatedAt);
        FHE.allowThis(s_contracts[contractId].isActive);
        FHE.allowThis(s_contracts[contractId].requiredSignatures);
        FHE.allowThis(s_contracts[contractId].currentSignatures);
        FHE.allowThis(s_contracts[contractId].currentSignaturesRetreated);
        FHE.allow(s_contracts[contractId].id, msg.sender);
    }

    // ****************************************ACTIONS**************************************************

    /**
     * @dev Firma un contrato por el signer correspondiente en el contrato
     * @param contractId ID del contrato a firmar
     */
    function signContract(
        uint64 contractId
    ) external nonReentrant returns (uint256) {
        //euint64 contractId = FHE.fromExternal(externalContractId, attestation);
        //FHE.allowThis(contractId);

        Contract storage contractData = s_contracts[contractId];

        if (!FHE.isSenderAllowed(contractData.id)) revert SignerNotAllowed();

        // `msg.sender` en eaddress para comparar cifrado
        eaddress senderE = FHE.asEaddress(msg.sender);
        FHE.allowThis(senderE);

        // Variables auxiliares
        euint8 one8 = FHE.asEuint8(1);
        //ebool updatedAny = FHE.asEbool(false);

        // Para cada firmante, activamos su firma si (soy el firmante) AND (no había firmado)
        for (uint i = 0; i < 4; i++) {
            ebool isMe = FHE.eq(contractData.signers[i].signer, senderE);
            ebool notSigned = FHE.not(contractData.signers[i].hasSigned);
            ebool canSign = FHE.and(isMe, notSigned);

            // hasSigned := select(canSign, true, hasSigned)
            contractData.signers[i].hasSigned = FHE.select(
                canSign,
                FHE.asEbool(true),
                contractData.signers[i].hasSigned
            );
            FHE.allowThis(contractData.signers[i].hasSigned);

            // currentSignatures += select(canSign, 1, 0)
            euint8 inc = FHE.select(canSign, one8, FHE.asEuint8(0));
            contractData.currentSignatures = FHE.add(contractData.currentSignatures, inc);
            FHE.allowThis(contractData.currentSignatures);

            // Marcar si alguien firmó en esta llamada
            //updatedAny = FHE.or(updatedAny, canSign);
        }

        // updatedAt := ahora (no condicionamos por privacidad)
        contractData.updatedAt = FHE.asEuint64(uint64(block.timestamp));
        FHE.allowThis(contractData.updatedAt);

        // Activar contrato si current == required
        ebool allSigned = FHE.eq(contractData.currentSignatures, contractData.requiredSignatures);
        contractData.isActive = FHE.select(allSigned, FHE.asEbool(true), contractData.isActive);
        FHE.allowThis(contractData.isActive);

        // Dar Acceso de la actualizacion a los Signers
        uint256 latestRequestId = requestSigners(
            contractData.signers[0].signer,
            contractData.signers[1].signer,
            contractData.signers[2].signer,
            contractData.signers[3].signer,
            contractId
        );

        return latestRequestId;
    }

    /**
     * @dev Permite a un firmante invalidar un contrato, el contrato pasa a desactivarse cuando se cumplen todas las firmas requeridas
     * @param contractId ID del contrato del cual retirarse
     */
    function retreatContract(
        uint64 contractId
    ) external nonReentrant returns (uint256) {
        //euint64 contractId = FHE.fromExternal(externalContractId, attestation);
        //FHE.allowThis(contractId);

        Contract storage contractData = s_contracts[contractId];

        if (!FHE.isSenderAllowed(contractData.id)) revert SignerNotAllowed();

        // `msg.sender` en eaddress para comparar cifrado
        eaddress senderE = FHE.asEaddress(msg.sender);
        FHE.allowThis(senderE);

        // Variables auxiliares
        euint8 one8 = FHE.asEuint8(1);
        //ebool updatedAny = FHE.asEbool(false);

        // Para cada firmante, activamos su firma si (soy el firmante) AND (no había firmado)
        for (uint i = 0; i < 4; i++) {
            ebool isMe = FHE.eq(contractData.signers[i].signer, senderE);
            ebool notRetreated = FHE.not(contractData.signers[i].retreated);
            ebool canSign = FHE.and(isMe, notRetreated);

            // retreated := select(canSign, true, retreated)
            contractData.signers[i].retreated = FHE.select(
                canSign,
                FHE.asEbool(true),
                contractData.signers[i].retreated
            );
            FHE.allowThis(contractData.signers[i].retreated);

            // currentSignaturesRetreated += select(canSign, 1, 0)
            euint8 inc = FHE.select(canSign, one8, FHE.asEuint8(0));
            contractData.currentSignaturesRetreated = FHE.add(contractData.currentSignaturesRetreated, inc);
            FHE.allowThis(contractData.currentSignaturesRetreated);

            // Marcar si alguien firmó en esta llamada
            //updatedAny = FHE.or(updatedAny, canSign);
        }

        // updatedAt := ahora (no condicionamos por privacidad)
        contractData.updatedAt = FHE.asEuint64(uint64(block.timestamp));
        FHE.allowThis(contractData.updatedAt);

        // Activar contrato si current == required
        ebool allRetreated = FHE.eq(contractData.currentSignaturesRetreated, contractData.requiredSignatures);
        contractData.isActive = FHE.select(allRetreated, FHE.asEbool(false), contractData.isActive);
        FHE.allowThis(contractData.isActive);

        // Dar Acceso de la actualizacion a los Signers
        uint256 latestRequestId = requestSigners(
            contractData.signers[0].signer,
            contractData.signers[1].signer,
            contractData.signers[2].signer,
            contractData.signers[3].signer,
            contractId
        );

        return latestRequestId;
    }

    // ****************************************CALLBACKS**************************************************

    /**
     * @dev Solicita desencriptar los address planos de los signers de un contrato para guardarlos en el mapping s_signers => contractId y generar los eventos
     */
    function requestSigners(
        eaddress addr1,
        eaddress addr2,
        eaddress addr3,
        eaddress addr4,
        uint64 contractId
    ) private returns (uint256) {
        bytes32[] memory cts = new bytes32[](4);
        cts[0] = FHE.toBytes32(addr1);
        cts[1] = FHE.toBytes32(addr2);
        cts[2] = FHE.toBytes32(addr3);
        cts[3] = FHE.toBytes32(addr4);
        uint256 latestRequestId = FHE.requestDecryption(cts, this.CustomCallback.selector);

        s_LastRequest.contractId = contractId;
        s_LastRequest.isDecryptionPending = true;
        s_LastRequest.latestRequestId = latestRequestId;

        return latestRequestId;
    }

    /**
     * @dev Callback para recibir los address planos de los signers para guardarlos en el mapping s_signers => contractId y generar los eventos
     */
    function CustomCallback(
        uint256 requestId,
        address addr1,
        address addr2,
        address addr3,
        address addr4,
        bytes[] memory signatures
    ) public {
        /// @dev This check is used to verify that the request id is the expected one.
        if (requestId != s_LastRequest.latestRequestId) revert InvalidRequestId();
        FHE.checkSignatures(requestId, signatures);

        // Recuperar el contrato correcto
        uint64 contractId = s_LastRequest.contractId;
        Contract memory c = s_contracts[contractId];

        address[4] memory addrs = [addr1, addr2, addr3, addr4];

        for (uint256 i = 0; i < 4; i++) {
            if (addrs[i] != address(0)) {
                // Guardar suscripción
                s_signers[addrs[i]].push(c.id);

                // Dar permisos a cada signer sobre los campos cifrados del contrato
                FHE.allow(c.id, addrs[i]);
                FHE.allow(c.createdBy, addrs[i]);
                FHE.allow(c.createdAt, addrs[i]);
                FHE.allow(c.updatedAt, addrs[i]);
                FHE.allow(c.isActive, addrs[i]);
                FHE.allow(c.requiredSignatures, addrs[i]);
                FHE.allow(c.currentSignatures, addrs[i]);
                FHE.allow(c.currentSignaturesRetreated, addrs[i]);

                // Si también dar acceso a los signers[]
                // for (uint j = 0; j < 4; j++) {
                //     FHE.allow(addrs[i], c.signers[j].signer);
                //     FHE.allow(addrs[i], c.signers[j].hasSigned);
                // }

                // Emitir evento
                emit SignerAdded(addrs[i], contractId, c.title, c.typeDoc);
            }
        }

        s_LastRequest.isDecryptionPending = false;
    }

    // ****************************************GETTERS**************************************************

    /**
     * @dev Obtiene los firmantes de un contrato
     * @param contractId ID del contrato
     */
    function getContractSigners(
        uint64 contractId
    ) external view returns (Signer[4] memory) {
        //euint64 contractId = FHE.fromExternal(externalContractId, attestation);
        //FHE.allowThis(contractId);

        Contract memory contractData = s_contracts[contractId];

        if (!FHE.isSenderAllowed(contractData.id)) revert SignerNotAllowed();

        return s_contracts[contractId].signers;
    }

    /**
     * @dev Obtiene la información de un contrato sin signers
     * @param contractId ID del contrato
     */
    function getContract(
        uint64 contractId
    )
        external
        view
        returns (
            euint64 id,
            string memory title,
            string memory description,
            string memory typeDoc,
            euint64 createdAt,
            euint64 updatedAt,
            bytes32 hashdoc,
            ebool isActive,
            euint8 requiredSignatures,
            euint8 currentSignatures,
            euint8 currentSignaturesRetreated
        )
    {
        //euint64 contractId = FHE.fromExternal(externalContractId, attestation);
        //FHE.allowThis(contractId);

        Contract memory contractData = s_contracts[contractId];

        if (!FHE.isSenderAllowed(contractData.id)) revert SignerNotAllowed();
    
        return (
            contractData.id,
            contractData.title,
            contractData.description,
            contractData.typeDoc,
            contractData.createdAt,
            contractData.updatedAt,
            contractData.hashDoc,
            contractData.isActive,
            contractData.requiredSignatures,
            contractData.currentSignatures,
            contractData.currentSignaturesRetreated
        );
    }

    /**
     * @dev Obtiene todos los contratos de un firmante
     */
    function getSignerContracts() external view returns (euint64[] memory) {
        return s_signers[msg.sender];
    }

    /**
     * @dev Obtiene el contador total de contratos
     */
    function getContractCounter() external view returns (uint64) {
        return s_contractCounter;
    }

    /**
     * @dev Obtiene la última solicitud
     */
    function getLastRequest() external view returns (Request memory) {
        return s_LastRequest;
    }
}
