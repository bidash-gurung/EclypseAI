// We'll eventually transform each trial into a structure like this:
// {
//   "nctId": "NCT01234567",
//   "title": "Example Clinical Study",
//   "status": "RECRUITING",
//   "conditions": ["Diabetes"],
//   "interventions": ["Example Drug"],
//   "phase": ["PHASE3"],
//   "sponsor": "Example Sponsor",
//   "locations": []
// }

function normalizeTrial(study) {
  const protocol = study.protocolSection || {};

  const identification = protocol.identificationModule || {};

  const status = protocol.statusModule || {};

  const design = protocol.designModule || {};

  const conditions = protocol.conditionsModule || {};

  const interventions = protocol.armsInterventionsModule || {};

  const sponsor = protocol.sponsorCollaboratorsModule || {};

  const contactsLocations = protocol.contactsLocationsModule || {};

  const identificationInfo = {
    nctId: identification.nctId || null,
    title:
      identification.briefTitle ||
      identification.officialTitle ||
      "Untitled study",
  };

  const locations = (contactsLocations.locations || []).map((location) => ({
    facility: location.facility || null,
    city: location.city || null,
    state: location.state || null,
    country: location.country || null,
    latitude: location.geoPoint?.lat ?? null,
    longitude: location.geoPoint?.lon ?? null,
  }));

  return {
    ...identificationInfo,

    status: status.overallStatus || null,

    startDate: status.startDateStruct?.date || null,

    completionDate: status.completionDateStruct?.date || null,

    conditions: conditions.conditions || [],

    interventions: (interventions.interventions || []).map((item) => ({
      name: item.name || null,
      type: item.type || null,
    })),

    phases: design.phases || [],

    studyType: design.studyType || null,

    sponsor: sponsor.leadSponsor?.name || null,

    locations,
  };
}

module.exports = { normalizeTrial };
