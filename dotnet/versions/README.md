# Version Builder
Generates version based on branches

## Release

```bash
npm run build
# update tag
TAG=v4 && git tag -f $TAG && git push origin $TAG -f
```