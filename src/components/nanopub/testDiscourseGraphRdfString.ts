const creditTerms = [
  "conceptualization",
  "data-curation",
  "formal-analysis",
  "funding-acquisition",
  "investigation",
  "methodology",
  "project-administration",
  "resources",
  "software",
  "supervision",
  "validation",
  "visualization",
  "writing-original-draft",
  "writing-review-editing",
];

export const testing = {
  "@context": {
    "@base": "http://purl.org/nanopub/temp/mynanopub#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    dc: "http://purl.org/dc/terms/",
    np: "http://www.nanopub.org/nschema#",
    foaf: "http://xmlns.com/foaf/0.1/",
    xsd: "http://www.w3.org/2001/XMLSchema#",
  },
  "@id": "#Head",
  "@graph": {
    "@id": "#",
    "@type": "np:Nanopublication",
    "np:hasAssertion": {
      "@id": "#assertion",
      "@graph": [
        {
          "@id": "#",
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": {
            "@value": "Evidence",
          },
        },
        {
          "@id": "#",
          "http://www.w3.org/2000/01/rdf-schema#label": {
            "@value": "[[EVD]] - example published evd - [[@someSource]]",
          },
        },
        {
          "@id": "#",
          "http://purl.org/dc/terms/description": {
            "@value": "",
          },
        },
        {
          "@id": "#",
          "http://xmlns.com/foaf/0.1/page": {
            "@value": "https://roamresearch.com/roamjs-dev/page/pfW74_4-F",
          },
        },
      ],
    },
    "np:hasProvenance": {
      "@id": "#provenance",
      "@graph": [
        {
          "@id": "#assertion",
          "http://www.w3.org/ns/prov#wasAttributedTo": {
            "@id": "https://orcid.org/1234-1234-1234-1234",
          },
          "credit:conceptualization": ["Michael Gartner"],
          "credit:writing-original-draft": ["Michael Gartner"],
          "credit:writing-review-editing": ["Michael Gartner"],
          "credit:formal-analysis": ["Joe Schmidt", "Jane Foster"],
          "credit:investigation": ["Joe Schmidt", "Jane Foster"],
          "credit:funding-acquisition": ["Jane Foster"],
          "credit:methodology": ["Jane Foster"],
        },
      ],
    },
    "np:hasPublicationInfo": {
      "@id": "#pubinfo",
      "@graph": [
        {
          "@id": "#pubinfo",
          "http://purl.org/dc/terms/creator": {
            "@value": "Michael Gartner",
          },
        },
        {
          "@id": "#",
          "@type": "npx:ExampleNanopub",
        },
      ],
    },
  },
};
export const testDiscourseGraphRdfSringWorking = {
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
    credit: "https://credit.niso.org/contributor-roles/",
    "has the label": "http://www.w3.org/2000/01/rdf-schema#label",
  },
  "@id": "#Head",
  "@graph": [
    {
      "@id": "#",
      "@type": "np:Nanopublication",
      "np:hasAssertion": {
        "@id": "#assertion",
        "@graph": [
          {
            "@id": "#",
            "rdf:type": {
              "@id": "https://w3id.org/kpxl/gen/terms/Evidence",
            },
            "has the label": {
              "@value": "[[EVD]] - example published evd - [[@someSource]]",
            },
            "dct:description": "{body}",
            "foaf:page": {
              "@id": "https://roamresearch.com/#/app/roamjs-dev/page/pfW74_4-F",
            },
          },
        ],
      },
      "np:hasProvenance": {
        "@id": "#provenance",
        "@graph": [
          {
            "@id": "#assertion",
            "prov:wasAttributedTo": [
              {
                "@id": "https://orcid.org/1234-1234-1234-1234",
              },
            ],
            "credit:supervision": "John Doe",
            "credit:formal-analysis": "John Doe",
            "credit:conceptualization": "John Doe",
            "credit:data-curation": "Jane Smith",
            "credit:funding-acquisition": "Jane Smith",
            "credit:investigation": "Mark Johnson",
          },
        ],
      },
      "np:hasPublicationInfo": {
        "@id": "#pubinfo",
        "@graph": [
          {
            "dct:creator": {
              "@id": "https://orcid.org/1234-1234-1234-1234",
            },
            "http://purl.org/nanopub/x/introduces": {
              "@id": "#evidence",
            },
            "@id": "#",
          },
        ],
      },
    },
  ],
};

const testDiscourseGraphRdfSring = {
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
    credit: "https://credit.niso.org/contributor-roles/",
    "has the label": "http://www.w3.org/2000/01/rdf-schema#label",
  },
  "@id": "#Head",
  "@graph": [
    {
      "@graph": [
        {
          "@id": "#",
          "@type": ["http://www.nanopub.org/nschema#Nanopublication"],
          "http://www.nanopub.org/nschema#hasAssertion": [
            {
              "@id": "#assertion",
            },
          ],
          "http://www.nanopub.org/nschema#hasProvenance": [
            {
              "@id": "#provenance",
            },
          ],
          "http://www.nanopub.org/nschema#hasPublicationInfo": [
            {
              "@id": "#pubinfo",
            },
          ],
        },
      ],
      "@id": "#Head",
    },
    {
      "@graph": [
        {
          "@id": "http://purl.org/dc/terms/description",
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "has the description",
            },
          ],
        },
        {
          "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "is a",
            },
          ],
        },
        {
          "@id": "http://www.w3.org/2000/01/rdf-schema#label",
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "has the label",
            },
          ],
        },
        {
          "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso",
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "has more info at",
            },
          ],
        },
        {
          "@id": "https://w3id.org/kpxl/gen/terms/Claim",
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "claim",
            },
          ],
        },
        {
          "@id": "#assertion",
          "@type": [
            "https://w3id.org/np/o/ntemplate/AssertionTemplate",
            "https://w3id.org/np/o/ntemplate/UnlistedTemplate",
          ],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "Publishing a claim",
            },
          ],
          "https://w3id.org/np/o/ntemplate/hasStatement": [
            {
              "@id": "#st1",
            },
            {
              "@id": "#st2",
            },
            {
              "@id": "#st3",
            },
            {
              "@id": "#st4",
            },
          ],
          "https://w3id.org/np/o/ntemplate/hasTargetNanopubType": [
            {
              "@id": "https://w3id.org/kpxl/gen/terms/ClaimsAndEvidences",
            },
          ],
        },
        {
          "@id": "#claim",
          "@type": [
            "https://w3id.org/np/o/ntemplate/IntroducedResource",
            "https://w3id.org/np/o/ntemplate/LocalResource",
          ],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "this claim",
            },
          ],
        },
        {
          "@id": "#description",
          "@type": ["https://w3id.org/np/o/ntemplate/LongLiteralPlaceholder"],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "description of the claim",
            },
          ],
        },
        {
          "@id": "#label",
          "@type": ["https://w3id.org/np/o/ntemplate/LiteralPlaceholder"],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "label for the claim",
            },
          ],
        },
        {
          "@id": "#link",
          "@type": ["https://w3id.org/np/o/ntemplate/ExternalUriPlaceholder"],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "link with further info",
            },
          ],
        },
        {
          "@id": "#st1",
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#object": [
            {
              "@id": "https://w3id.org/kpxl/gen/terms/Claim",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate": [
            {
              "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject": [
            {
              "@id": "#claim",
            },
          ],
        },
        {
          "@id": "#st2",
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#object": [
            {
              "@id": "#label",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate": [
            {
              "@id": "http://www.w3.org/2000/01/rdf-schema#label",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject": [
            {
              "@id": "#claim",
            },
          ],
        },
        {
          "@id": "#st3",
          "@type": ["https://w3id.org/np/o/ntemplate/OptionalStatement"],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#object": [
            {
              "@id": "#description",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate": [
            {
              "@id": "http://purl.org/dc/terms/description",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject": [
            {
              "@id": "#claim",
            },
          ],
        },
        {
          "@id": "#st4",
          "@type": [
            "https://w3id.org/np/o/ntemplate/OptionalStatement",
            "https://w3id.org/np/o/ntemplate/RepeatableStatement",
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#object": [
            {
              "@id": "#link",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate": [
            {
              "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            },
          ],
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject": [
            {
              "@id": "#claim",
            },
          ],
        },
      ],
      "@id": "#assertion",
    },
    {
      "@graph": [
        {
          "@id": "#assertion",
          "http://www.w3.org/ns/prov#wasAttributedTo": [
            {
              "@id": "https://orcid.org/0000-0002-1267-0234",
            },
          ],
        },
      ],
      "@id": "#provenance",
    },
    {
      "@graph": [
        {
          "@id": "https://orcid.org/0000-0002-1267-0234",
          "http://xmlns.com/foaf/0.1/name": [
            {
              "@value": "Tobias Kuhn",
            },
          ],
        },
        {
          "@id": "#",
          "http://purl.org/dc/terms/created": [
            {
              "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
              "@value": "2024-05-10T11:24:43.141Z",
            },
          ],
          "http://purl.org/dc/terms/creator": [
            {
              "@id": "https://orcid.org/0000-0002-1267-0234",
            },
          ],
          "http://purl.org/dc/terms/license": [
            {
              "@id": "https://creativecommons.org/licenses/by/4.0/",
            },
          ],
          "http://purl.org/nanopub/x/supersedes": [
            {
              "@id":
                "https://w3id.org/np/RAO24kk-IVqe-Lbp0DYScuttBqXgLBvbAbsHcvaezrrzM",
            },
          ],
          "http://purl.org/nanopub/x/wasCreatedAt": [
            {
              "@id": "https://nanodash.knowledgepixels.com/",
            },
          ],
          "http://www.w3.org/2000/01/rdf-schema#label": [
            {
              "@value": "Template: Publishing a claim",
            },
          ],
          "https://w3id.org/np/o/ntemplate/wasCreatedFromProvenanceTemplate": [
            {
              "@id":
                "http://purl.org/np/RANwQa4ICWS5SOjw7gp99nBpXBasapwtZF1fIM3H2gYTM",
            },
          ],
          "https://w3id.org/np/o/ntemplate/wasCreatedFromPubinfoTemplate": [
            {
              "@id":
                "http://purl.org/np/RAA2MfqdBCzmz9yVWjKLXNbyfBNcwsMmOqcNUxkk1maIM",
            },
            {
              "@id":
                "http://purl.org/np/RAh1gm83JiG5M6kDxXhaYT1l49nCzyrckMvTzcPn-iv90",
            },
            {
              "@id":
                "http://purl.org/np/RAjpBMlw3owYhJUBo3DtsuDlXsNAJ8cnGeWAutDVjuAuI",
            },
          ],
          "https://w3id.org/np/o/ntemplate/wasCreatedFromTemplate": [
            {
              "@id":
                "http://purl.org/np/RAJwu5sVubRqXY4t2gkSoGxWkMyZqnpkGTCPiTlmvi4so",
            },
          ],
        },
        {
          "@id": "#sig",
          "http://purl.org/nanopub/x/hasAlgorithm": [
            {
              "@value": "RSA",
            },
          ],
          "http://purl.org/nanopub/x/hasPublicKey": [
            {
              "@value":
                "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD4Wj537OijfOWVtsHMznuXKISqBhtGDQZfdO6pbb4hg9EHMcUFGTLbWaPrP783PHv8HMAAPjvEkHLaOHMIknqhaIa5236lfBO3r+ljVdYBElBcLvROmwG+ZGtmPNZf7lMhI15xf5TfoaSa84AFRd5J2EXekK6PhaFQhRm1IpSYtwIDAQAB",
            },
          ],
          "http://purl.org/nanopub/x/hasSignature": [
            {
              "@value":
                "1fcuhHXVEbNE0GIj5BVSjSjlJQN9HaNBetBOoQLWnKTlFlJFvwzti37IT2qudFm8HCKTlFCaUshB1wMMpNkuv3RnMWOOfIGDcoFKRNETZYIbS9pGKChQCZaG7fmnAFDfLulO2C3ceqfkPs+kbGgqJgHwUH6TOp++3LaYhxHpAJs=",
            },
          ],
          "http://purl.org/nanopub/x/hasSignatureTarget": [
            {
              "@id": "#",
            },
          ],
          "http://purl.org/nanopub/x/signedBy": [
            {
              "@id": "https://orcid.org/0000-0002-1267-0234",
            },
          ],
        },
      ],
      "@id": "#pubinfo",
    },
  ],
};

export default testDiscourseGraphRdfSring;
