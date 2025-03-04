#!/bin/bash

# Function to check for missing and extra build arguments
function check_build_args() {
  local dockerfile="$1"
  local passed_args="$2"

  # Extract ARG variables from the Dockerfile
  local required_args=$(grep -oP '^ARG \K\S+' "$dockerfile" || true)

  # Extract ARGs that have default values (ignore these in missing check)
  local default_args=$(grep -oP '^ARG \K\S+=.*' "$dockerfile" | cut -d'=' -f1 || true)

  echo "Checking Dockerfile: $dockerfile"

  # Convert required_args and default_args to arrays
  required_args_array=($required_args)
  default_args_array=($default_args)

  # Check for missing arguments (only if they do NOT have a default value)
  for arg in "${required_args_array[@]}"; do
    if [[ ! " ${default_args_array[*]} " =~ " $arg " ]] && [[ ! " $passed_args " =~ " $arg=" ]]; then
      echo "WARNING: Missing build argument: $arg (defined in $dockerfile but not passed, and has no default value)"
    else
      echo "OK: Argument $arg is either passed or has a default value"
    fi
  done

  # Check for extra arguments (passed but not defined in Dockerfile)
  for passed_arg in $passed_args; do
    arg_name=$(echo "$passed_arg" | cut -d'=' -f1)
    if [[ ! " ${required_args_array[*]} " =~ " $arg_name " ]]; then
      echo "WARNING: Extra build argument: $arg_name (passed but not defined in $dockerfile)"
    fi
  done
}

# Create test cases
mkdir -p test_scenarios
cd test_scenarios || exit 1

echo "Running test scenarios..."

# Scenario 1: All required arguments provided correctly
echo -e "ARG VERSION\nARG ENV" > Dockerfile1
check_build_args "Dockerfile1" "VERSION=1.0 ENV=production"

echo ""

# Scenario 2: Missing one required argument
echo -e "ARG VERSION\nARG ENV\nARG API_KEY" > Dockerfile2
check_build_args "Dockerfile2" "VERSION=1.0 ENV=production"

echo ""

# Scenario 3: No arguments provided, but required
echo -e "ARG USERNAME\nARG PASSWORD" > Dockerfile3
check_build_args "Dockerfile3" ""

echo ""

# Scenario 4: Dockerfile without ARG directives (should detect extra args)
echo -e "FROM alpine\nRUN echo 'No ARGs here'" > Dockerfile4
check_build_args "Dockerfile4" "SOME_VAR=foo"

echo ""

# Scenario 5: Extra arguments provided
echo -e "ARG APP_NAME\nARG DEBUG" > Dockerfile5
check_build_args "Dockerfile5" "APP_NAME=myapp DEBUG=true EXTRA_VAR=should_not_be_here"

echo ""

# Scenario 6: Arguments with default values (should be ignored in missing check)
echo -e "ARG PORT=8080\nARG MODE=production\nARG API_KEY" > Dockerfile6
check_build_args "Dockerfile6" "API_KEY=secret"

echo ""

echo "Test scenarios completed."

# Clean up
cd ..
rm -rf test_scenarios
