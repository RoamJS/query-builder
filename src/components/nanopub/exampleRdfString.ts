const exampleRdfString = {
  "@context": {
    "@base": "http://purl.org/nanopub/temp/mynanopub#",
    np: "http://www.nanopub.org/nschema#",
    npx: "http://purl.org/nanopub/x/",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    foaf: "http://xmlns.com/foaf/0.1/",
    dct: "http://purl.org/dc/terms/",
    prov: "http://www.w3.org/ns/prov#",
    pav: "http://purl.org/pav/",
    orcid: "https://orcid.org/",
    schema: "https://schema.org/",
  },
  "@id": "#Head",
  "@graph": {
    "@id": "#",
    "@type": "np:Nanopublication",
    "np:hasAssertion": {
      "@id": "#assertion",
      "@context": {
        ex: "http://example.org/",
      },
      "@graph": [
        {
          "@id": "ex:mosquito",
          "ex:transmits": { "@id": "ex:malaria" },
        },
      ],
    },
    "np:hasProvenance": {
      "@id": "#provenance",
      "@graph": [
        {
          "@id": "#assertion",
          "prov:hadPrimarySource": {
            "@id": "http://dx.doi.org/10.3233/ISU-2010-0613",
          },
        },
      ],
    },
    "np:hasPublicationInfo": {
      "@id": "#pubinfo",
      "@graph": [
        {
          "@id": "#",
          "@type": "npx:ExampleNanopub",
        },
      ],
    },
  },
};

export default exampleRdfString;
