# @artidv1/react

React wrapper around [`@artidv1/widget`](https://www.npmjs.com/package/@artidv1/widget).

```bash
npm i @artidv1/react
```

```tsx
import { ArtIDWidget, ArtIDButton, useArtID } from "@artidv1/react";

export function CollectionPage() {
  return (
    <ArtIDWidget
      collection="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
      onRegistered={(d) => console.log("Minted:", d.subdomain)}
    />
  );
}
```

Custom styling — pass children to use your own button chrome:

```tsx
<ArtIDButton collection="0x..." className="my-button">
  Open my museum
</ArtIDButton>
```

Imperative:

```tsx
const { open } = useArtID();
<button onClick={() => open({ collection: "0x...", tokenId: "1" })}>Mint</button>;
```

License: MIT.
