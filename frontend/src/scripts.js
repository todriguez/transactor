function setTooltipAttributes() {
  const tooltipItems = document.querySelectorAll("#sighashMenu .list-group-item");
  const templateKeys = [
    "all",
    "none",
    "single",
    "all-anyonecanpay",
    "none-anyonecanpay",
    "single-anyonecanpay",
  ];

  tooltipItems.forEach((item, index) => {
    const tooltipJSON = commonKeys.reduce((acc, key) => {
      const row = sighashTemplates[templateKeys[index]].find((row) => row.key === key);
      const value = row ? row.value : "-";
      acc[key] = value === "" ? "32-byte zero hash" : value;
      return acc;
    }, {});

    item.setAttribute("data-bs-toggle", "tooltip");
    item.setAttribute("data-bs-html", "true");
    item.setAttribute("data-bs-original-title", `<pre>${JSON.stringify(tooltipJSON, null, 2)}</pre>`);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  // Call the setTooltipAttributes function
  setTooltipAttributes();

  // Initialize the tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Other event listeners
  document.getElementById("processTransactionDataButton").addEventListener("click", () => {
    const inputCount = parseInt(document.querySelector("#inputCount").value);
    const transaction = createTransactionFromForm();
    displayTransactionJSON(transaction);
    displayPreImages(inputCount);
  });

  document.querySelector('#generatekeypair').addEventListener('click', generateKeyPair);
  document.querySelector('#mineBlocks').addEventListener('click', mineBlocks);

  document.getElementById('createSighashButton').addEventListener('click', async () => {
    const transaction = createTransactionFromForm();
    const preimages = createSighashPreImages(transaction);
    const sighashes = [];

    for (const preimage of preimages) {
      const hash = await callBackendHashing(preimage);
      sighashes.push(hash);
    }

    displaySighashes(sighashes);
  });

  document.getElementById("inputCount").addEventListener("change", (event) => {
    createInputContainers(event);
  });

  document.getElementById("outputCount").addEventListener("change", (event) => {
    createOutputContainers(event);
  });

  document.getElementById('generatekeypair').addEventListener('click', generateKeyPair);
  document.getElementById('mineBlocks').addEventListener('click', mineBlocks);
  document.getElementById('signSigHash').addEventListener('click', signSigHash);
  document.getElementById('generateRawTx').addEventListener('click', generateRawTx);
  document.getElementById('generateTXID').addEventListener('click', generateTXID);
  document.getElementById('broadcastTX').addEventListener('click', broadcastTX);

  document.getElementById('inputCount').addEventListener('input', createInputContainers);
  document.getElementById('outputCount').addEventListener('input', createOutputContainers);
});

window.addEventListener("load", () => {
  document.getElementById("inputContainers").innerHTML = "";
  document.getElementById("outputContainers").innerHTML = "";
  // Call logTooltipJSON() to log the JSON for each tooltip in the console
  logTooltipJSON();
  });
  

async function generateKeyPair(event) {
  event.preventDefault();

  try {
    const response = await fetch("http://203.18.30.236:8090/generate-keypair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const publicKey = result.publicKey;

    const keyPairTableBody = document.getElementById("keypairTableBody");
    const row = document.createElement("tr");

    const indexCell = document.createElement("td");
    const publicKeyCell = document.createElement("td");
    const privateKeyCell = document.createElement("td");
    const addressCell = document.createElement("td");

    // Define the index variable
    const index = keyPairTableBody.children.length + 1;

    indexCell.innerText = index;
    publicKeyCell.innerText = publicKey;
    privateKeyCell.innerText = result.privateKey;
    addressCell.innerText = result.address;

    row.appendChild(indexCell);
    row.appendChild(publicKeyCell);
    row.appendChild(privateKeyCell);
    row.appendChild(addressCell);

    keyPairTableBody.appendChild(row);

    // Add options to the drop-down menu when new key pairs are generated
    const keyPairSelector = document.querySelector('#keyPairSelector');
    const newOption = document.createElement('option');
    newOption.value = index;
    newOption.innerText = `Index ${index}`;
    keyPairSelector.appendChild(newOption);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function mineBlocks() {
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const selectedIndex = keyPairSelector.value;

  // Get the address from the table
  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const addressCell = selectedRow.children[3];
  const selectedAddress = addressCell.innerText;

  console.log(`Mining 110 blocks to address with index: ${selectedIndex}`);

  try {
    const response = await fetch(`http://203.18.30.236:8090/api/mine-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: selectedAddress }),
    });

    if (!response.ok) {
      throw new Error('Error mining blocks');
    }

    const minedData = await response.json();
    console.log('Mined data:', minedData);
    displaySpendableTransactionOutputs(minedData.transactions);
  } catch (error) { // Add this catch block
    console.error('Error:', error);
  }

}

// Add this helper function to fetch transaction details from the Woc explorer API
async function fetchTransactionDetails(txHash) {
  const response = await fetch(`http://203.18.30.236:8090/api/proxy-transaction-details?txHash=${txHash}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const txDetails = await response.json();
  return txDetails;
}

function createSpendableTransactionOutput(index, txDetails, output, selectedPrivateKey) {
  const lockScriptSize = output.scriptPubKey.hex.length / 2;
  const unlockScriptSize = output.scriptPubKey.hex.length / 2;

  return {
    index: index,
    blockHeight: txDetails.blockheight,
    blockHash: txDetails.blockhash,
    vout: output.n,
    txid: txDetails.txid,
    value: output.value,
    lockScriptSize: lockScriptSize,
    lockScriptAsm: output.scriptPubKey.asm,
    lockScriptHex: output.scriptPubKey.hex,
    reqSigs: output.scriptPubKey.reqSigs,
    confirmations: txDetails.confirmations,
    privateKey: selectedPrivateKey,
    unlockScriptSize: unlockScriptSize,
    unlockScript: output.scriptPubKey.hex,
    sequence: 0xffffffff,
    sighashFlag: '01',
  };
}

async function fetchSTODetails(sto) {
  return {
    txid: sto.txid,
    vout: sto.vout,
    value: sto.value,
    unlockScript: sto.unlockScript,
    sequence: sto.sequence,
    sighashFlag: sto.sighashFlag,
  };
}

async function displaySpendableTransactionOutputs(transactions) {
  const stoContainer = document.querySelector("#stoContainer");
  const keyPairSelector = document.querySelector("#keyPairSelector");
  const selectedIndex = keyPairSelector.value;

  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const privateKeyCell = selectedRow.children[2];
  const selectedPrivateKey = privateKeyCell.innerText;

  stoContainer.innerHTML = ""; // clear the container before populating new data

  const spendableTransactionOutputs = [];

  const transactionPromises = transactions.map(async (transaction, index) => {
    const txDetails = await fetchTransactionDetails(transaction.txid);
    const output = txDetails.vout[0];
    const sto = createSpendableTransactionOutput(index + 1, txDetails, output, selectedPrivateKey);
    spendableTransactionOutputs.push(sto);
  });

  await Promise.all(transactionPromises);

  // Sort spendable transaction outputs by block height
  spendableTransactionOutputs.sort((a, b) => a.blockHeight - b.blockHeight);

  // Display spendable transaction outputs
  spendableTransactionOutputs.forEach((spendableTransactionOutput, index) => {
    const stoElement = document.createElement("pre");
    stoElement.id = `sto-json-${index + 1}`;
    stoElement.className = "sto-json";
    stoElement.style.display = index === 0 ? "block" : "none";
    stoElement.innerText = JSON.stringify(spendableTransactionOutput, null, 2);
    stoContainer.appendChild(stoElement);
  });

  // Create pagination navigation
  const paginationNav = document.createElement("div");
  paginationNav.className = "pagination-nav";

  spendableTransactionOutputs.forEach((_, index) => {
    const navLink = document.createElement("a");
    navLink.href = "#";
    navLink.innerText = index + 1;
    navLink.addEventListener("click", (e) => {
      e.preventDefault();
      showStoElement(index);
    });

    paginationNav.appendChild(navLink);
  });

  stoContainer.appendChild(paginationNav);

  // Return the spendable transaction outputs
  return spendableTransactionOutputs;
}

function showStoElement(index) {
  const stoElements = document.querySelectorAll(".sto-json");

  stoElements.forEach((element, i) => {
    element.style.display = i === index ? "block" : "none";
  });
}

function getTransactionVersionValue() {
  return getElementValueById('version');
}

function getElementValueById(id, index) {
  let element;
  if (index === undefined) {
    element = document.getElementById(id) || document.getElementById(capitalizeFirstLetter(id));
  } else {
    element = document.querySelector(`input[id^="${id}-${index}"], input[id^="${capitalizeFirstLetter(id)}-${index}"]`);
  }
  return element ? element.value : null;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function createTransactionFromForm() {
  const transactionLockTime = parseInt(document.querySelector("#nLockTime").value).toString(16).padStart(8, "0");

  const inputs = getInputs().map(input => ({
    ...input,
    prevoutN: input.prevoutN.toString(16).padStart(8, "0"),
    sighashFlag: input.sighashFlag.toString(16),
    sequence: input.sequence.toString(16).padStart(8, "0"),
  }));
  const outputs = getOutputs();

  const transaction = {
    version: getTransactionVersionValue().padStart(8, "0"),
    inputCount: toVarInt(inputs.length),
    inputs: inputs,
    outputCount: toVarInt(outputs.length),
    outputs: outputs,
    nLockTime: transactionLockTime,
  };

  return transaction;
}



function getInputs() {
  const inputCount = parseInt(document.getElementById("inputCount").value, 16);
  const inputs = [];

  for (let i = 0; i < inputCount; i++) {
    const prevoutHash = document.getElementById(`inputTXID-${i}`).value;
    const prevoutN = parseInt(document.getElementById(`inputVOUT-${i}`).value, 16);
    const unlockScript = document.getElementById(`inputUnlockScript-${i}`).value;
    const sequence = parseInt(document.getElementById(`inputSequence-${i}`).value, 16);
    const sighashFlag = parseInt(document.getElementById(`sighashFlag-${i}`).value, 16);

    const unlockScriptSize = unlockScript.length / 2; // Divide by 2 since each byte is represented by 2 hexadecimal characters

    inputs.push({ prevoutHash, prevoutN, unlockScript, sequence, sighashFlag, unlockScriptSize });
  }

  return inputs;
}

function getOutputs() {
  const outputCount = parseInt(document.getElementById("outputCount").value, 16);
  const outputs = [];

  for (let i = 0; i < outputCount; i++) {
    const value = parseInt(document.getElementById(`outputValue-${i}`).value, 16);
    const lockScript = document.getElementById(`outputlockScript-${i}`).value;

    const lockScriptSize = lockScript.length / 2; // Divide by 2 since each byte is represented by 2 hexadecimal characters

    outputs.push({ value, lockScript, lockScriptSize });
  }

  return outputs;
}

async function callBackendHashing(data) {
  const response = await fetch('http://203.18.30.236:8090/api/double-sha256', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const result = await response.json();
  return result.hash;
}

async function hashPrevouts(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.txid + input.vout;
  }
  return await callBackendHashing(buffer);
}

async function hashSequence(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.sequence;
  }
  return await callBackendHashing(buffer);
}

async function hashOutputs(outputs) {
  let buffer = "";
  for (const output of outputs) {
    buffer += output.value + output.lockScriptSize + output.lockScript;
  }
  return await callBackendHashing(buffer);
}

async function hashSingleOutput(output) {
  const buffer = output.value + output.lockScriptSize + output.lockScript;
  return await callBackendHashing(buffer);
}

function displayPreImages(inputCount) {
  const preimagesContainer = document.getElementById("preimagesContainer");

  // Remove existing preimage JSON containers
  preimagesContainer.innerHTML = "";

  // Create new preimage JSON containers
  const preimageJSONTemplate = document.getElementById("preimageJSONTemplate");
  for (let i = 0; i < inputCount; i++) {
    const newPreimageJSON = preimageJSONTemplate.content.cloneNode(true);
    newPreimageJSON.querySelector(".preimageIndex").textContent = i + 1;

    // Add collapsible behavior
    const collapseButton = newPreimageJSON.querySelector(".preimageToggle");
    collapseButton.setAttribute("data-bs-target", `#preimageContent-${i}`);

    const collapseContent = newPreimageJSON.querySelector(".preimageContent");
    collapseContent.id = `preimageContent-${i}`;

    // Set unique IDs for each form field
    const formFields = newPreimageJSON.querySelectorAll(".form-control");
    formFields.forEach((field) => {
      field.id = field.classList.item(1) + "-" + i;
    });

    // Add event listener to the hash buttons
    const hashButtons = newPreimageJSON.querySelectorAll(".hashButton");
    hashButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        let previousField, nextField;
        if (button.classList.contains("hashPrevoutsButton")) {
          previousField = button.parentElement.querySelector(".Prevouts");
          nextField = button.parentElement.querySelector(".hashPrevouts");
        } else if (button.classList.contains("hashSequenceButton")) {
          previousField = button.parentElement.querySelector(".Sequence");
          nextField = button.parentElement.querySelector(".hashSequence");
        }
        const hashedValue = await callBackendHashing(previousField.value);
        nextField.value = hashedValue;
      });
    });

    preimagesContainer.appendChild(newPreimageJSON);
  }
}


async function handleHashButtonClick(event) {
  const button = event.target;
  let previousField, nextField;
  if (button.classList.contains("hashPrevoutsButton")) {
    previousField = button.parentElement.querySelector(".Prevouts");
    nextField = button.parentElement.querySelector(".hashPrevouts");
  } else if (button.classList.contains("hashSequenceButton")) {
    previousField = button.parentElement.querySelector(".Sequence");
    nextField = button.parentElement.querySelector(".hashSequence");
  }
  const hashedValue = await callBackendHashing(previousField.value);
  nextField.value = hashedValue;
}

function parseVarInt(hex, start) {
  const firstByte = parseInt(hex.substr(start * 2, 2), 16);
  let value;
  let size;

  if (firstByte < 0xfd) {
    value = hex.substr(start * 2, 2);
    size = 1;
  } else if (firstByte === 0xfd) {
    value = hex.substr((start + 1) * 2, 4);
    size = 3;
  } else if (firstByte === 0xfe) {
    value = hex.substr((start + 1) * 2, 8);
    size = 5;
  } else {
    value = hex.substr((start + 1) * 2, 16);
    size = 9;
  }

  return { value, size };
}

function toVarInt(value) {
  if (value < 0xfd) {
    return value.toString(16).padStart(2, "0");
  } else if (value <= 0xffff) {
    return "fd" + value.toString(16).padStart(4, "0");
  } else if (value <= 0xffffffff) {
    return "fe" + value.toString(16).padStart(8, "0");
  } else {
    return "ff" + value.toString(16).padStart(16, "0");
  }
}

function intToHexString(value, byteSize) {
  return value.toString(16).padStart(byteSize * 2, "0");
}

function createInputContainers(event) {
  updateInputOrOutputContainers("input", event);
}

function createOutputContainers(event) {
  updateInputOrOutputContainers("output", event);
}

document.getElementById("inputCount").addEventListener("change", (event) => {
  createInputContainers(event);
});

document.getElementById("outputCount").addEventListener("change", (event) => {
  createOutputContainers(event);
});


function updateInputOrOutputContainers(containerType) {
  const countField = document.querySelector(`#${containerType}Count`);
  const countHex = countField.value;
  const count = parseInt(parseVarInt(countHex, 0).value, 16);
  const maxCount = 5;

  console.log(`${containerType} count:`, count);

  if (count <= maxCount) {
    const containers = document.getElementById(`${containerType}Containers`);

    // Clear the containers div before adding new ones
    containers.innerHTML = "";

    const containerTemplate = document.getElementById(`${containerType}ContainerTemplate`);

    for (let i = 0; i < count; i++) {
      const newContainer = containerTemplate.content.cloneNode(true);
      newContainer.querySelector(`.${containerType}Index`).textContent = i + 1;

      // Add collapsible behavior
      const collapseButton = newContainer.querySelector(`button[data-bs-toggle="collapse"]`);
      collapseButton.setAttribute("data-bs-target", `#${containerType}Content-${i}`);

      const collapseContent = newContainer.querySelector(".collapse");
      collapseContent.id = `${containerType}Content-${i}`;

      // Set unique ids for the fields
      newContainer.querySelectorAll("input, select").forEach((element) => {
        const name = element.getAttribute("name");
        element.id = `${name}-${i}`;
      });

      // Append the new container as a child of the parent div
      containers.appendChild(newContainer);
    }
  }

  // Update preimage JSON containers when input count changes
  if (containerType === "input") {
    displayPreImages(count);
  }
}


function displayTransactionJSON(transaction) {
  const transactionJSONContainer = document.getElementById("transactionJSONContainer");

  // Remove the existing transaction JSON data if it exists
  const existingTransactionData = transactionJSONContainer.querySelector("pre");
  if (existingTransactionData) {
    transactionJSONContainer.removeChild(existingTransactionData);
  }

  // Create a pre element to display the transaction JSON data
  const transactionJSONData = document.createElement("pre");
  transactionJSONData.innerText = JSON.stringify(transaction, null, 2);

  // Append the pre element to the transaction JSON container
  transactionJSONContainer.appendChild(transactionJSONData);
}

function showPreimageElement(index) {
  const preimageElements = document.querySelectorAll(".preimage-json");

  preimageElements.forEach((element, i) => {
    element.style.display = i === index ? "block" : "none";
  });
}
 
async function processTransactionData() {
  const version = document.getElementById("version").value;
  const inputCount = document.getElementById("inputCount").value;
  const inputs = getInputs();
  const outputCount = document.getElementById("outputCount").value;
  const outputs = getOutputs();
  const nLockTime = document.getElementById("nLockTime").value;

  const payload = {
    version,
    inputCount,
    inputs,
    outputCount,
    outputs,
    nLockTime,
  };

  console.log("Transaction Payload:", JSON.stringify(payload, null, 2));

  // Display the transaction JSON payload in the browser
  displayTransactionJSON(payload);

  // Call the backend service to process the transaction data
}

// Add the event listener for the "Process Transaction Data" button
document.getElementById("processTransactionDataButton").addEventListener("click", processTransactionData);

const baseTemplate = [
  { key: "nVersion", value: "4-byte little-endian" },
  { key: "hashPrevouts", value: "32-byte SHA256d of all concatenated inputs' TXIDs and vouts, both in little-endian format" },
  { key: "hashSequence", value: "32-byte SHA256d of all concatenated inputs' nSequence values, little-endian format" },
  { key: "outpoint", value: "32-byte input txid in little-endian + 4-byte vout in little-endian" },
  { key: "lockScript", value: "CompactSize varInt for lockScript size + lockScript of the output being spent" },
  { key: "value", value: "8-byte satoshis, little-endian format" },
  { key: "nSequence", value: "4-byte little-endian of the input being signed" },
  { key: "hashOutputs", value: "32-byte SHA256d of all concatenated outputs' values, CompactSize varInt for lockScript size, and lockScripts, values in little-endian format" },
  { key: "nLockTime", value: "4-byte little-endian" },
  { key: "nHashType", value: "4-byte little-endian" },
];

const zeroHashField = { key: "32-byte zero hash", value: "" };

const sighashTemplates = {
  all: baseTemplate,
  none: [
    ...baseTemplate.slice(0, 2),
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    zeroHashField,
    ...baseTemplate.slice(7),
  ],
  single: [
    ...baseTemplate.slice(0, 2),
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    { key: "hashOutputs", value: "SHA256d of the single output corresponding to the input being signed, value in little-endian format" },
    ...baseTemplate.slice(7),
  ],
  "all-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    ...baseTemplate.slice(2),
  ],
  "none-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    zeroHashField,
    ...baseTemplate.slice(7),
  ],
  "single-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    { key: "hashOutputs", value: "SHA256d of the single output corresponding to the input being signed, value in little-endian format" },
    ...baseTemplate.slice(7),
  ],
};


const commonKeys = [
  "nVersion",
  "hashPrevouts",
  "hashSequence",
  "outpoint",
  "lockScript",
  "value",
  "nSequence",
  "hashOutputs",
  "nLockTime",
  "nHashType",
];


function logTooltipJSON() {
  const templateKeys = [
    "all",
    "none",
    "single",
    "all-anyonecanpay",
    "none-anyonecanpay",
    "single-anyonecanpay",
  ];

  templateKeys.forEach((templateKey) => {
    const tooltipJSON = commonKeys.reduce((acc, key) => {
      const row = sighashTemplates[templateKey].find((row) => row.key === key);
      const value = row ? row.value : "-";
      acc[key] = value === "" ? "32-byte zero hash" : value;
      return acc;
    }, {});

    console.log(`${templateKey}:\n${JSON.stringify(tooltipJSON, null, 2)}\n`);
  });
}

// Helper function to reverse the byte order
function reverseEndian(hexString) {
  return hexString.match(/.{2}/g).reverse().join("");
}

// Convert bitcoins to satoshis
document.getElementById("btcToSatoshisButton").addEventListener("click", function () {
  const btc = parseFloat(document.getElementById("btcToSatoshis").value);
  const satoshis = Math.round(btc * 100000000);
  document.getElementById("btcToSatoshisResult").textContent = satoshis;
});

// Convert decimal to hexadecimal
document.getElementById("decimalToHexButton").addEventListener("click", function () {
  const decimal = parseInt(document.getElementById("decimalToHex").value);
  const hex = decimal.toString(16);
  document.getElementById("decimalToHexResult").textContent = hex;
});

// Switch endianness
document.getElementById("switchEndianButton").addEventListener("click", function () {
  const hex = document.getElementById("switchEndian").value;
  const switchedEndian = reverseEndian(hex);
  document.getElementById("switchEndianResult").textContent = switchedEndian;
});


