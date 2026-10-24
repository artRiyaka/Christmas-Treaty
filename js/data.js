"use strict";

/* Demonstrative records for The Christmas Treaty. Nothing here is a live service. */
window.CT = window.CT || {};

CT.demoUser = { id: "u_alex", name: "Alex Carter" };

CT.charities = [
  { id: "red-cross", name: "British Red Cross", cause: "Emergency support at home and abroad", url: "https://www.redcross.org.uk/get-involved/donate" },
  { id: "unicef", name: "UNICEF UK", cause: "Health, education, and emergency aid for children", url: "https://www.unicef.org.uk/donate/" },
  { id: "save-the-children", name: "Save the Children UK", cause: "Protecting children in the UK and worldwide", url: "https://www.savethechildren.org.uk/how-you-can-help/make-a-donation" },
  { id: "oxfam", name: "Oxfam", cause: "Tackling poverty and inequality", url: "https://www.oxfam.org.uk/donate/" },
  { id: "msf", name: "Médecins Sans Frontières", cause: "Independent medical care in crises", url: "https://msf.org.uk/donate" },
  { id: "wwf", name: "WWF", cause: "Restoring wildlife and the natural world", url: "https://www.wwf.org.uk/donate" },
  { id: "shelter", name: "Shelter", cause: "Help for people facing bad housing and homelessness", url: "https://www.shelter.org.uk/donate" },
  { id: "crisis", name: "Crisis", cause: "Helping people leave homelessness behind", url: "https://www.crisis.org.uk/get-involved/donate/" },
  { id: "trussell", name: "Trussell", cause: "Emergency food and support to end hunger", url: "https://www.trussell.org.uk/donate" },
  { id: "macmillan", name: "Macmillan Cancer Support", cause: "Practical and emotional support with cancer", url: "https://www.macmillan.org.uk/donate" },
  { id: "cancer-research", name: "Cancer Research UK", cause: "Research to prevent, diagnose, and treat cancer", url: "https://www.cancerresearchuk.org/get-involved/donate" },
  { id: "mind", name: "Mind", cause: "Mental health advice and local support", url: "https://www.mind.org.uk/donate/" },
  { id: "nspcc", name: "NSPCC", cause: "Protecting children from abuse", url: "https://www.nspcc.org.uk/donate/" },
  { id: "wateraid", name: "WaterAid", cause: "Clean water, toilets, and hygiene", url: "https://www.wateraid.org/uk/donate" },
  { id: "charity-water", name: "charity: water", cause: "Clean water projects around the world", url: "https://www.charitywater.org/donate" },
  { id: "irc", name: "International Rescue Committee", cause: "Aid for people whose lives are uprooted", url: "https://www.rescue-uk.org/donate" },
  { id: "habitat", name: "Habitat for Humanity", cause: "Safe places to call home", url: "https://www.habitat.org/donate" },
  { id: "salvation-army", name: "The Salvation Army", cause: "Practical help for people in hardship", url: "https://www.salvationarmy.org.uk/donate" },
  { id: "dogs-trust", name: "Dogs Trust", cause: "Care and rehoming for dogs", url: "https://www.dogstrust.org.uk/support-us/donate" },
  { id: "woodland", name: "Woodland Trust", cause: "Protecting woods and trees", url: "https://www.woodlandtrust.org.uk/support-us/give/" }
];

CT.charityById = function (id) {
  return CT.charities.find(function (charity) { return charity.id === id; }) || null;
};

CT.createSeed = function () {
  const now = Date.now();
  const day = 86400000;
  const alex = CT.demoUser;

  return {
    user: null,
    treaties: [
      {
        id: "t_sam",
        token: "sam7c1e0a4b9d84f6c2a11e0b7d5",
        creatorId: "u_sam",
        creatorName: "Sam Okonkwo",
        recipientId: alex.id,
        recipientName: alex.name,
        creatorAmount: 50,
        proposedAmount: 50,
        recipientAmount: null,
        creatorCharityId: null,
        recipientCharityId: null,
        creatorDonated: false,
        recipientDonated: false,
        status: "pending",
        createdAt: now - day,
        updatedAt: now - day
      },
      {
        id: "t_priya",
        token: "priya4e8b21c0aa9735d6f10e4c88",
        creatorId: alex.id,
        creatorName: alex.name,
        recipientId: null,
        recipientName: "Priya Shah",
        creatorAmount: 30,
        proposedAmount: 30,
        recipientAmount: 30,
        creatorCharityId: "macmillan",
        recipientCharityId: "wateraid",
        creatorDonated: false,
        recipientDonated: false,
        status: "accepted",
        createdAt: now - 5 * day,
        updatedAt: now - 2 * day
      },
      {
        id: "t_noah",
        token: "noah88d0c51ab3476e9021ff4ab3c",
        creatorId: alex.id,
        creatorName: alex.name,
        recipientId: null,
        recipientName: "Noah Ellis",
        creatorAmount: 25,
        proposedAmount: 25,
        recipientAmount: 20,
        creatorCharityId: "trussell",
        recipientCharityId: "woodland",
        creatorDonated: true,
        recipientDonated: true,
        status: "complete",
        createdAt: now - 20 * day,
        updatedAt: now - 12 * day
      }
    ],
    journey: [
      { id: "e_sam_1", treatyId: "t_sam", type: "treaty_created", label: "Treaty proposed", at: now - day },
      { id: "e_sam_2", treatyId: "t_sam", type: "invitation_ready", label: "Private link ready", at: now - day + 60000 },

      { id: "e_priya_1", treatyId: "t_priya", type: "treaty_created", label: "Treaty proposed", at: now - 5 * day },
      { id: "e_priya_2", treatyId: "t_priya", type: "invitation_ready", label: "Private link ready", at: now - 5 * day + 60000 },
      { id: "e_priya_3", treatyId: "t_priya", type: "invitation_opened", label: "Invitation opened", at: now - 4 * day },
      { id: "e_priya_4", treatyId: "t_priya", type: "treaty_accepted", label: "Treaty accepted", at: now - 4 * day + 600000 },
      { id: "e_priya_5", treatyId: "t_priya", type: "charity_chosen", label: "Charity chosen for Priya Shah · WaterAid", at: now - 3 * day },
      { id: "e_priya_6", treatyId: "t_priya", type: "charity_chosen", label: "Charity chosen for Alex Carter · Macmillan Cancer Support", at: now - 2 * day },

      { id: "e_noah_1", treatyId: "t_noah", type: "treaty_created", label: "Treaty proposed", at: now - 20 * day },
      { id: "e_noah_2", treatyId: "t_noah", type: "invitation_ready", label: "Private link ready", at: now - 20 * day + 60000 },
      { id: "e_noah_3", treatyId: "t_noah", type: "invitation_opened", label: "Invitation opened", at: now - 19 * day },
      { id: "e_noah_4", treatyId: "t_noah", type: "amount_adjusted", label: "Amount adjusted from £25 to £20", at: now - 19 * day + 120000 },
      { id: "e_noah_5", treatyId: "t_noah", type: "treaty_accepted", label: "Treaty accepted", at: now - 19 * day + 180000 },
      { id: "e_noah_6", treatyId: "t_noah", type: "charity_chosen", label: "Charity chosen for Noah Ellis · Woodland Trust", at: now - 18 * day },
      { id: "e_noah_7", treatyId: "t_noah", type: "charity_chosen", label: "Charity chosen for Alex Carter · Trussell", at: now - 17 * day },
      { id: "e_noah_8", treatyId: "t_noah", type: "donation_reported", label: "Donation reported · Alex Carter", at: now - 14 * day },
      { id: "e_noah_9", treatyId: "t_noah", type: "donation_reported", label: "Donation reported · Noah Ellis", at: now - 12 * day },
      { id: "e_noah_10", treatyId: "t_noah", type: "treaty_complete", label: "Treaty complete", at: now - 12 * day + 1000 }
    ]
  };
};
