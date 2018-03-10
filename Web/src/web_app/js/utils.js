const apiConfig = {
    base: "http://localhost:10010",
    campaigns: "/campaigns",
    contracts: "/contracts",
    tokens: "/tokens"
};

const ethToWei = 1.0e18;
const gasPrice = 5000000000;
const gas = 4312388;

function forceMetamask() {
    var hasMetamask = (typeof web3 !== 'undefined' && window.web3.givenProvider && window.web3.givenProvider.isMetaMask);
    if (hasMetamask) return;

    var html = '<div class="alert alert-danger" role="alert"><strong>No Metamask detected!</strong> This page requires Metamask to function properly. Please install it and refresh.</div>';
    $('body').html(html);
}

function initWeb3() {
    if (typeof web3 !== 'undefined') {
        console.log('Web3 injected browser: OK.')
        window.web3 = new Web3(window.web3.givenProvider);
    } else {
        //TODO: implement normal wallet
        console.log('No web3? You should consider trying MetaMask!');
        window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    }
}

function getMetaMaskAccount() {
    return new Promise((resolve, reject) => {
        web3.eth.getAccounts(function (error, accounts) {
            if (!error && accounts.length > 0) {
                resolve(accounts[0]);
            } else {
                resolve();
            }
        });
    });
}

function deployCrowdfundingContract() {
    var self = this;
    this.$http.get(apiConfig.base + apiConfig.contracts + '/CampaignTokenFundraiser')
        .then(resp => {
            var response = resp.body;
            var params = [self.crowdfundingContract_beneficiaryAddress, self.crowdfundingContract_endDate,
            self.crowdfundingContract_conversionRate, self.crowdfundingContract_description, self.crowdfundingContract_minCap];
            self.deployContract(response.bytecode, response.abi, params)
                .then((result) => {
                    showSuccess('Crowdfunding contract created', 'Address: ' + result.contract._address);
                    //TODO: save details of token contract as well
                    self.saveCrowdfundingContractToDB(result.contract._address, params);
                }).catch(result => {
                    showError(result.message);
                });
        }, err => {
            showError("Error getting CampaignTokenFundraiser contract info.", err);
        });
}

function saveCrowdfundingContractToDB(address, params) {
    var body = {
        fundraiserContractAddress: address,
        beneficiaryAddress: params[0],
        endDate: parseInt(params[1]),
        conversionRate: parseInt(params[2]),
        description: params[3],
        minCap: parseInt(params[4])
    };

    this.$http.post(apiConfig.base + apiConfig.campaigns, body)
        .then(resp => {
            //TODO: do stuff
        }, err => {
            showError("Error saving Campaign info.", err);
        });
}

function getCampaignContractsFromDB() {
    return $.get(apiConfig.base + apiConfig.campaigns);
}

function getTokenContractsFromDB() {
    return $.get(apiConfig.base + apiConfig.tokens);
}

async function getCampaignBalance(campaignAddress) {
    return new Promise(async (resolve, reject) => {
        var fundraiserContract = await getContractByAddress('CampaignTokenFundraiser', campaignAddress);
        fundraiserContract.methods.getCampaignBalance().call(
            { from: await getMetaMaskAccount(), gas: gas, gasPrice: gasPrice }, function (error, result) {
                if (error) reject(error);
                else resolve(result);
            });
    });
}

function stateEnumToString(enumVal) {
    return ["Collecting Funds", "Waiting for Tokens", "Refunding", "Completed", "Canceled"][enumVal];
}

async function getCampaignState(campaignAddress) {
    return new Promise(async (resolve, reject) => {
        var userAddress = await getMetaMaskAccount();
        var fundraiserContract = await getContractByAddress('CampaignTokenFundraiser', campaignAddress);
        fundraiserContract.methods.getState().call({ from: userAddress, gas: gas, gasPrice: gasPrice }, function (error, result) {
            if (error) reject(error);
            else resolve(stateEnumToString(result));
        });
    });
}

async function getCampaignParticipantsCount(campaignAddress) {
    return new Promise(async (resolve, reject) => {
        var fundraiserContract = await getContractByAddress('CampaignTokenFundraiser', campaignAddress);

        fundraiserContract.methods
            .getParticipantsNumber()
            .call({ from: await getMetaMaskAccount(), gas: gas, gasPrice: gasPrice }, function (error, result) {
                if (error) reject(error);
                else resolve(result);
            });
    });
}

async function deployContract(bytecode, abi, params) {
    return new Promise(async (resolve, reject) => {
        var contract = new web3.eth.Contract(abi);
        contract.deploy({
            data: bytecode,
            arguments: params
        }).send({ from: await getMetaMaskAccount(), gas: gas, gasPrice: gasPrice }, function (error, transactionHash) {
            if (error) {
                reject({ error: true, message: error.message });
            }
        })
            .on('error', error => reject({ error: true, message: error.message }))
            .then(function (newContractInstance) {
                console.log('info', newContractInstance.options.address);
                resolve({ contract: newContractInstance, abi: abi });
            });
    }, function (error) {
        reject({ error: true, message: error.message });
    });
}

function contributeToCampaign(campaignContractAddress, userAddress, amountETH) {
    return new Promise(async (resolve, reject) => {
        if (campaignContractAddress == '') reject('Campaign address cannot be empty!');
        if (userAddress == '') reject('User address cannot be empty!');
        if (amountETH <= 0) reject('Amount should be non-negative!');

        var contract = await getContractByAddress('CampaignTokenFundraiser', campaignContractAddress);
        contract.methods.buyTokens()
            .send({ from: userAddress, value: parseInt(amountETH * ethToWei), gas: gas, gasPrice: gasPrice })
            .on('confirmation', function (confirmationNumber, receipt) {
                resolve(receipt);
            })
            .on('error', reject);
    });
}

async function getContractByAddress(name, address) {
    return new Promise((resolve, reject) => {
        $.get(apiConfig.base + apiConfig.contracts + '/' + name)
            .then(response => {
                var contract = new web3.eth.Contract(response.abi, address);
                resolve(contract);
            })
            .catch(reject);
    });
}

function deployFundsharesToken() {
    var self = this;
    this.$http.get(apiConfig.base + apiConfig.contracts + '/FundSharesToken')
        .then(resp => {
            var response = resp.body;
            self.contracts.fundsharesToken.bytecode = response.bytecode;
            self.contracts.fundsharesToken.abi = response.abi;
            var params = [self.tokenContract_name, self.tokenContract_symbol, self.tokenContract_totalSupply,
            self.tokenContract_rate, self.tokenContract_minInvestment];
            self.deployContract(response.bytecode, response.abi, params)
                .then((result) => {
                    self.contracts.fundsharesToken.address = result.contract._address;
                    self.contracts.fundsharesToken.abi = result.abi;
                    self.contracts.fundsharesToken.instance = result.contract;
                    self.saveTokenContractToDB(result.contract._address, params);
                    showSuccess('Token contract created', 'Address: ' + result.contract._address);
                }).catch(result => {
                    showError('Error creating token contract', result.message);
                });
        }, err => {
            showError("Error getting FundSharesToken contract info.", err);
        });
}

function saveTokenContractToDB(address, params) {
    var body = {
        address: address,
        name: params[0],
        symbol: params[1],
        totalSupply: parseInt(params[2]),
        rate: parseInt(params[3]),
        minParticipation: parseInt(params[4])
    };

    this.$http.post(apiConfig.base + apiConfig.tokens, body)
        .then(resp => {
            //TODO: do stuff
        }, err => {
            showError("Error saving Token info.", err);
        });
}

async function purchaseFundshares() {
    var self = this;
    var fundsharesTokenContract = new web3.eth.Contract(self.contracts.fundsharesToken.abi, self.contracts.fundsharesToken.address);
    fundsharesTokenContract.methods.buyTokens().send({ from: await getMetaMaskAccount(), value: 1 * ethToWei, gas: gas, gasPrice: gasPrice })
        .on('confirmation', function (confirmationNumber, receipt) {
            self.purchaseFundsharesReceipt = receipt;
        })
        .on('error', console.error);
}

async function sendEthToFundshares() {
    var self = this;
    var weiValue = parseFloat(this.sendValueAmount) * ethToWei;
    web3.eth.sendTransaction({
        from: await getMetaMaskAccount(), to: self.sendToAddress, value: weiValue,
        gasPrice: gasPrice, gas: gas
    }, function (err, txhash) {
        if (err && err.message) {
            showError('error: ' + err.message);
        } else {
            showSuccess('Successfully sent transcation. Txhash: ' + txhash);
        }
    })
}

async function viewTokensBalance() {
    if (!this.tokenContractUserAddress) { showError("Missing data", "Please enter user address"); return; }
    if (!this.selectedTokenContractSymbol) { showError("Missing data", "Please select token contract first"); return; }
    if (!this.selectedTokenContractAddress) { showError("Missing data", "Please select token contract first"); return; }

    var self = this;
    var tokenContract = await getContractByAddress('FundSharestoken', self.selectedTokenContractAddress);
    tokenContract.methods.balanceOf(self.tokenContractUserAddress).call(
        { from: await getMetaMaskAccount(), gas: gas, gasPrice: gasPrice }, function (error, result) {
            if (error) {
                showError('Cannot retrieve user balance: ', err.message);
            }
            showSuccess('Balance check', 'User '+ self.tokenContractUserAddress + ' has ' + result + ' ' + self.selectedTokenContractSymbol + ' tokens');
        });
}

function showError(title, message) {
    var html = '<div class="alert alert-danger" role="alert" id="bootstrap-error"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><strong>' + title + ' </strong> ' + message + '</div>';
    $('#alert-placeholder').html(html);
}

function showSuccess(title, message) {
    var html = '<div class="alert alert-success" role="alert" id="bootstrap-success"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><strong>' + title + ' </strong> ' + message + '</div>';
    $('#alert-placeholder').html(html);
}