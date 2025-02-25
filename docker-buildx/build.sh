#          if (istagused "$AWS_REGISTRY_ID" "$NAME" "$VERSION"); then
#            echo "::warning::$NAME:$TAG already exists on remote... skipping $service..."
#            continue
#          fi