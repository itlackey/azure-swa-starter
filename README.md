# Azure Static Site Starter Kit
This starter kit uses Svelte and Eleventy to build the static site frontend. It also includes a basic example 
of using JavaScript Managed Functions as a backend. 

## Getting started

You can use `degit` create a copy one of the available starter kits by running one of the commands below.

```
# Copy the latest starter kit with JS API
npx degit itlackey/azure-swa-starter {you_dir_name}

# Copy the latest starter kit with PY API
npx degit itlackey/azure-swa-starter#py {you_dir_name}

# Copy the latest starter kit with no API or Svelte components, plain old static HTML/JS/CSS
npx degit itlackey/azure-swa-starter#basic {you_dir_name}

```

## Tools
To use the pre-configured npm scripts, you will need to install the Azure Static Website CLI tool globally.

### Installing CLI tools

```bash
npm i -g @azure/static-web-apps-cli
```

## Running locally

* `npm start` - local server using swa CLI
* `npm run debug` - swa cli will wait for you to launch the 'Debug Functions' session in VSCode
* `npm run watch` - runs rollup and eleventy with watch flags
* `npm run 11ty` - runs rollup and eleventy with serve flags
* `npm run build` - runs rollup and eleventy build steps
* `npm run clean` - deletes .dist

## Customization
A few good places to start customizing this template...
### Layout / Theme
`site/assets` folder
### Switch Function runtime

Using VSCode extension...

## Deployment

### Create Static Site in Azure
Using VSCode extension...
Updates to the `.github/workflows` file
