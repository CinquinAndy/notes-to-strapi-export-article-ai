# Obsidian Strapi Article Creator

This Obsidian plugin allows you to easily create articles in Strapi CMS using the content from your Obsidian Markdown files. It automatically uploads images, generates SEO-friendly
content, and creates the article in Strapi with a single click.

## Features

- Upload images from Markdown files to Strapi
- Generate SEO-friendly article content using OpenAI's GPT-3
- Create articles in Strapi with the generated content and images
- Customize the JSON template for the article fields
- Configure the Strapi API URL, token, and content attribute name

## Installation

1. Clone this repository into your Obsidian plugins folder (usually located at `<vault>/.obsidian/plugins/`).
2. Enable the plugin in Obsidian's settings under "Community plugins".
3. Configure the necessary settings (see the Configuration section below).

## Configuration

Before using the plugin, you need to configure the following settings:

- **Strapi URL**: The URL of your Strapi instance (e.g., `https://your-strapi-url`).
- **Strapi API Token**: Your Strapi API token for authentication.
- **OpenAI API Key**: Your OpenAI API key for using GPT-3 to generate SEO-friendly content.
- **JSON Template**: The JSON template for the article fields in Strapi. Customize this according to your Strapi content type structure.
- **JSON Template Description**: A description for each field in the JSON template to help GPT-3 understand the structure.
- **Strapi Article Create URL**: The URL to create articles in Strapi (e.g., `https://your-strapi-url/api/articles`).
- **Strapi Content Attribute Name**: The attribute name for the article content in Strapi (default is `content`).

## Usage

1. Open a Markdown file in Obsidian.
2. Click on the plugin's ribbon icon to start the process.
3. The plugin will:
    - Extract images from the Markdown file
    - Generate descriptions, alt text, and captions for the images using OpenAI's GPT-3
    - Upload the images to Strapi
    - Generate SEO-friendly article content based on the Markdown file's content and the provided JSON template
    - Create a new article in Strapi with the generated content and uploaded images
4. If the process is successful, you will see a notice confirming that the article was created in Strapi.

## How it works

1. The plugin extracts image paths from the Markdown file and uploads the images to Strapi using the configured API URL and token.
2. It then uses OpenAI's GPT-3 to generate descriptions, alt text, and captions for the uploaded images.
3. The plugin replaces the local image paths in the Markdown file with the uploaded image URLs from Strapi.
4. It generates SEO-friendly article content using GPT-3 based on the Markdown file's content and the provided JSON template and description.
5. Finally, the plugin creates a new article in Strapi using the generated content and the uploaded images, according to the specified JSON template structure.

## Contributing

Feel free to submit issues and pull requests to improve the plugin. Make sure to follow the existing code style and include relevant tests when submitting pull requests.

### Roadmap

- [X] Get notes content from Obsidian
- [x] Config in the plugin settings for the token to use
- [x] Config in the plugin settings for the api url to use
- [x] Add clean errors notices messages
- [x] Upload images & attachments to Strapi
- [x] Replace image links in notes with Strapi media links

---

- [x] Connect custom api key for gpt-3
- [x] Connect custom api key for image recognition
- [x] Following my personnal template & fields

---

- [x] Part to generate alt / title for images
- [x] Part to generate slug for the article
- [x] Part to generate tags for the article
- [x] Part to generate linked articles
- [x] Part to generate seo_description
- [x] Part to generate seo_title
- [x] Part to generate excerpt

---

- [x] Upload to Strapi article
- [ ] Make it available as a plugin in Obsidian
- [ ] Make it usable by anyone, env variables for Strapi URL, user & password & token
- [ ] Config in the plugin settings for the schema to use
- [ ] Config in the plugin settings for the fields to use
- [ ] Add examples
- [ ] Clean Readme
- [ ] Add tests
- [ ] Clean manifest
- [ ] Renovate
