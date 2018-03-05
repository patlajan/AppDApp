'use strict';

const utils = require('../utils/contract_utils.js');

module.exports = {
    deployCampaignToken: deployCampaignToken,
    deployCampaignTokenFundraiser: deployCampaignTokenFundraiser
};

function deployCampaignToken(req, res) {
    var amount = req.swagger.params.body.value.amount;
    utils.createCampaignToken(amount).then((result) =>{ 
        res.json({address: result.contract._address, abi: result.abi});
    }).catch(result => {
        res.status(400);
        res.json({error: result.error, message: result.message});
    });
}

function deployCampaignTokenFundraiser(req, res) {
    var address = req.swagger.params.body.value.address;
    utils.createCampaignTokenFundraiser(address).then((result) => {
        res.json({address: result.contract._address, abi: result.abi});
    }).catch(result => {
        res.status(400);
        res.json({error: result.error, message: result.message});
    });
}

/*
(async function() {
    var h = require('./api/helpers/campaigns_contracts_helper.js');
    var contractAddress = '0x30753e4a8aad7f8597332e813735def5dd395028';
    var contract = await h.createContract('Campaigns', contractAddress);
    var res = await h.getCampaignHash(contract, 2);
  })();
  return;
  */
 // --- TEST --- 
// var h = require('../utils/contract_utils.js');
// var contractAddress = '0x30753e4a8aad7f8597332e813735def5dd395028';
// var contract = h.createContract('Campaigns', contractAddress).then(result => {
//     debugger;
//     h.getCampaignHash(result.contract, 2).then(result => {
//         if (result.error) {
//             res.status(400);
//             res.json({ error: true, message: result.error.message });
//         } else {
//             res.json(JSON.stringify(result.hash));
//         }
//     });;
// });
// --- END TEST --- 