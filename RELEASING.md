# Release process

Track every release in a GitHub Issue with its branch, dependencies, acceptance
criteria, validation evidence, and rollback plan.

1. Compare `package.json` with
   `npm view @kubohiroya/turbowarp-runtime-expression version` and choose the next
   semantic version. A new public export or API is at least a minor release.
2. Update `package.json`, `package-lock.json`, `CHANGELOG.md`, README, and both
   version-pinned user-guide URLs.
3. Run `npm ci`, `npm run check`, and
   `npm publish --dry-run --access public`. Inspect the packed file list and verify
   the standalone bundle, composition bundle, and declarations are present.
4. Merge the release PR only after review and CI succeed. Confirm main CI and the
   GitHub Pages deployment, including both language routes.
5. Publish once with `npm publish --access public`. Do not reuse an existing version.
6. Create and push an annotated `vX.Y.Z` tag at the release merge commit. The
   release workflow creates the GitHub Release and uploads both bundles,
   declarations, and the npm tarball.
7. Verify the npm dist-tag and tarball, the version-pinned CDN bundle, the GitHub
   Release assets, and the public Pages URLs. Record the exact URLs and commit in
   the Issue before closing it.

After publication, never delete or overwrite the npm version or tag. Deprecate a
defective package and publish a corrective patch. Consumers can pin the previous
version and remove the `./composition` import. Revert the release PR to roll back
documentation and let Pages redeploy.
