#! /bin/bash

function istagused() {
  REGISTRY_ID=$1
  REPOSITORY_NAME=$2
  TAG_RELEASE=$3

  set -x
  if aws ecr describe-images --repository-name="$REPOSITORY_NAME" --registry-id "$REGISTRY_ID" --image-ids=imageTag="$TAG_RELEASE" > /dev/null 2>&1; then
    return 0
  fi
  set +x
  return 1
}

function exe() { echo "\$ $@" ; "$@" ; }

VERSION=$(cat package.json | jq ".version" | xargs)
NAME=$(cat package.json | jq ".name" | xargs)

[[ $ECR_HOST =~ ^([0-9]*) ]] && AWS_REGISTRY_ID=${BASH_REMATCH[1]}

SERVICES=$(cat docker-compose.yml | yq eval '.services | keys' -P | sed 's/- //')

# ensure standard environment variables used are set
if [ -z "$ECR_HOST" ]; then
  echo "::warning::Environment variable ECR_HOST not set"
  return 1
fi

export NAME=$NAME
export TAG=$VERSION

RENDERED_COMPOSE_FILE="/tmp/rendered-compose.yaml"

# start build loop
DID_BUILD=0
for service in $SERVICES;
do
  if (istagused "$AWS_REGISTRY_ID" "$NAME" "$VERSION"); then
    echo "::warning::$NAME:$TAG already exists on remote... skipping $service..."
    continue
  fi

  echo "Building service ${service}"

  # Render docker-compose file every iteration, just in case we have diff environment variables
  docker compose config > $RENDERED_COMPOSE_FILE

  # arguments that are optional, and need to be passed to docker buildx
  PLATFORM_ARGS=""
  BUILD_ARGS=""

  # signal the pipeline that we did indeed to at least one build
  DID_BUILD=1

  # check if we need to do a multiplatform build
  PLATFORMS=$(cat $RENDERED_COMPOSE_FILE | yq eval ".services.${service}.platform" -)
  if [[ $PLATFORMS != 'null' ]];
  then
    echo "${service} - Preparing for multiplatform builds"
    PLATFORM_ARGS="--platform $PLATFORMS"
  else
    echo "${service} - Preparing for single platform build"
  fi

  # Get the build details
  DOCKER_FILE=$(cat $RENDERED_COMPOSE_FILE | yq eval ".services.${service}.build.dockerfile" -)
  IMAGE_TAG=$(cat $RENDERED_COMPOSE_FILE | yq eval ".services.${service}.image" -)
  ARGS=$(cat $RENDERED_COMPOSE_FILE | yq eval ".services.${service}.build.args" -)

  if [[ "$DOCKER_FILE" == 'null' ]]; then
    echo "::warning:: $service does not have a valid 'dockerfile' in the build config"
    continue
  fi

  # Check if `args` is defined for the service
  if [[ -n ${ARGS} ]];
  then
      echo "${service} - Building image with extra ARGS"

      # Build the `BUILD_ARGS` variable by mapping the `args` for each service
      BUILD_ARGS=$(yq eval '.services."'$service'".build.args | to_entries | map("--build-arg " + .key + "=" + .value) | join(" ")' $RENDERED_COMPOSE_FILE)
  fi

  # Build and push the docker image with the platform and arguments provided
  exe docker buildx build $BUILD_ARGS $PLATFORM_ARGS -t ${IMAGE_TAG} -f ${DOCKER_FILE} --progress plain --push .
  echo "${service} - Build complete"

  # outputs
  echo "image-tag=${IMAGE_TAG}" >> $GITHUB_OUTPUT
done