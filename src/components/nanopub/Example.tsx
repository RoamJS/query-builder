import React, { useEffect, useState } from "react";
import init, { Nanopub, NpProfile } from "@nanopub/sign";

export default function Home() {
  const [rdfOutput, setRdfOutput] = useState("");
  useEffect(() => {
    // ℹ️ You can also provide JSON-LD objects!
    const rdf = {
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
    const privateKey = `MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx+Y5q6UDEDM9Q0EksheNffJB4iPqsAfiFpY0ARQY92K5r8P4+a78eu9reYrb2WxZb1qPJmvR7XZ6sN1oHD7dd/EyQoJmQsmOKdrqaLRbzR7tZrf52yvKkwNWXcIVhW8uxe7iUgxiojZpW9srKoK/qFRpaUZSKn7Z/zgtDH9FJkYbBsGPDMqp78Kzt+sJb+U2W+wCSSy34jIUxx6QRbzvn6uexc/emFw/1DU5y7zBudhgC7mVk8vX1gUNKyjZBzlOmRcretrANgffqs5fx/TMHN1xtkA/H1u1IKBfKoyk/xThMLAgMBAAECggEAECuG0GZA3HF8OaqFgMG+W+agOvH04h4Pqv4cHjYNxnxpFcNV9nEssTKWSOvCwYy7hrwZBGV3PQzbjFmmrxVFs20+8yCD7KbyKKQZPVC0zf84bj6NTNgvr6DpGtDxINxuGaMjCt7enqhoRyRRuZ0fj2gD3Wqae/Ds8cpDCefkyMg0TvauHSUj244vGq5nt93txUv1Sa+/8tWZ77Dm0s5a3wUYB2IeAMl5WrO2GMvgzwH+zT+4kvNWg5S0Ze4KE+dG3lSIYZjo99h14LcQS9eALC/VBcAJ6pRXaCTT/TULtcLNeOpoc9Fu25f0yTsDt6Ga5ApliYkb7rDhV+OFrw1sYQKBgQDCE9so+dPg7qbp0cV+lbb7rrV43m5s9Klq0riS7u8m71oTwhmvm6gSLfjzqb8GLrmflCK4lKPDSTdwyvd+2SSmOXySw94zr1Pvc7sHdmMRyA7mH3m+zSOOgyCTTKyhDRCNcRIkysoL+DecDhNo4Fumf71tsqDYogfxpAQhn0re8wKBgQDXhMmmT2oXiMnYHhi2k7CJe3HUqkZgmW4W44SWqKHp0V6sjcHm0N0RT5Hz1BFFUd5Y0ZB3JLcah19myD1kKYCj7xz6oVLb8O7LeAZNlb0FsrtD7NU+Hciywo8qESiA7UYDkU6+hsmxaI01DsttMIdG4lSBbEjA7t4IQC5lyr7xiQKBgQCN87YGJ40Y5ZXCSgOZDepz9hqX2KGOIfnUv2HvXsIfiUwqTXs6HbD18xg3KL4myIBOvywSM+4ABYp+foY+Cpcq2btLIeZhiWjsKIrw71+Q/vIe0YDb1PGf6DsoYhmWBpdHzR9HN+hGjvwlsYny2L9Qbfhgxxmsuf7zeFLpQLijjwKBgH7TD28k8IOk5VKec2CNjKd600OYaA3UfCpP/OhDl/RmVtYoHWDcrBrRvkvEEd2/DZ8qw165Zl7gJs3vK+FTYvYVcfIzGPWA1KU7nkntwewmf3i7V8lT8ZTwVRsmObWU60ySJ8qKuwoBQodki2VX12NpMN1wgWe3qUUlr6gLJU4xAoGAet6nD3QKwk6TTmcGVfSWOzvpaDEzGkXjCLaxLKh9GreM/OE+h5aN2gUoFeQapG5rUwI/7Qq0xiLbRXw+OmfAoV2XKv7iI8DjdIh0F06mlEAwQ/B0CpbqkuuxphIbchtdcz/5ra233r3BMNIqBl3VDDVoJlgHPg9msOTRy13lFqc=`;

    // WebAssembly binary needs to be initialized only if the JS runs on the client
    init().then(async () => {
      const serverUrl = "";
      const profile = new NpProfile(
        privateKey,
        "https://orcid.org/0000-0000-0000-0000",
        "User Name",
        ""
      );

      const np = await new Nanopub(rdf).publish(profile, serverUrl);
      console.log("Published info dict:", np.info());
      setRdfOutput(np.rdf());
    });
  }, []);

  return (
    <main>
      <h1>Nanopublication RDF Output:</h1>
      <pre>
        <code>{rdfOutput}</code>
      </pre>
    </main>
  );
}
