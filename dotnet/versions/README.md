# Version Builder
Generates version based on branches

## Release

```bash
npm run build
# update tag
TAG=v2 && git tag -f $TAG && git push origin $TAG -f
```