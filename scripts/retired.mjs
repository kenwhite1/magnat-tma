// Rentlord is retired. Its Railway service (magnat-production) now runs 3D Monopoly
// from the magnat-3d repo, and @monopolyrubot opens it. Deploying this folder there
// would replace the 3D game, so building and starting are blocked on purpose.
console.error(`
  ✗ Rentlord (magnat) is retired and must not be deployed.
    The Monopoly server now runs 3D Monopoly. Deploy from ../magnat-3d instead:
    cd ../magnat-3d && railway up --detach -s c351cf20-f47d-4339-a9ec-882d8296ef88 -p bff5c7ad-eaf1-41d4-9454-f452af999126 -e production
`)
process.exit(1)
