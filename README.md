# 🚀 Strapi Exporter: Supercharge Your Obsidian-to-Strapi Workflow

[![Version](https://img.shields.io/github/package-json/v/CinquinAndy/notes-to-strapi-export-article-ai)](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/releases)
[![License](https://img.shields.io/github/license/CinquinAndy/notes-to-strapi-export-article-ai)](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/blob/main/LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-CinquinAndy-purple)](https://github.com/sponsors/CinquinAndy)

Strapi Exporter is a game-changing Obsidian plugin that streamlines your content creation process by seamlessly exporting your notes to Strapi CMS. With its AI-powered image
handling and SEO optimization features, you can take your content to the next level with just a few clicks.

## ✨ Features

- 🖼️ Automatically upload images from your notes to Strapi
- 🎨 Generate SEO-friendly alt text and captions for images using AI
- 📝 Create SEO-optimized article content based on your notes
- 🔧 Customize the JSON template for the article fields in Strapi
- ⚙️ Easy configuration for Strapi API URL, token, and content attribute name

## 🛠️ Installation

### If you're a simple user:

1. Download the latest release from the [releases page](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/releases/tag/)
2. Move the downloaded `main.js` file & `manifest.json` to your Obsidian plugins folder (usually located at `<vault>/.obsidian/plugins/`).
3. Enable the plugin in Obsidian's settings under "Community plugins".
4. Configure the necessary settings (see the Configuration section below).
5. Enjoy!

### If you're a developer:

To install Strapi Exporter, follow these steps (coming soon to the Obsidian plugin marketplace):

1. Clone this repository into your Obsidian plugins folder (usually located at `<vault>/.obsidian/plugins/`).
2. Enable the plugin in Obsidian's settings under "Community plugins".
3. Configure the necessary settings (see the Configuration section below).

## ⚙️ Configuration

To get started with Strapi Exporter, you'll need to configure the following settings:

- **Strapi URL**: The URL of your Strapi instance (e.g., `https://your-strapi-url`).
- **Strapi API Token**: Your Strapi API token for authentication.
- **OpenAI API Key**: Your OpenAI API key for using GPT-3 to generate SEO-friendly content.
- **Image Recognition API Key**: Your API key for image recognition (used to generate alt text and captions).
- **JSON Template**: The JSON template for the article fields in Strapi. Customize this according to your Strapi content type structure.
- **JSON Template Description**: A description for each field in the JSON template to help GPT-3 understand the structure.
- **Strapi Article Create URL**: The URL to create articles in Strapi (e.g., `https://your-strapi-url/api/articles`).
- **Strapi Content Attribute Name**: The attribute name for the article content in Strapi (default is `content`).

## 🚀 Usage

1. Open a Markdown file in Obsidian.
2. Click on the plugin's ribbon icon to start the magic.
3. Sit back and relax while Strapi Exporter does the heavy lifting:
    - 🖼️ Extracting and uploading images to Strapi
    - 🎨 Generating SEO-friendly alt text and captions for images
    - 📝 Creating SEO-optimized article content based on your notes
    - 🌐 Publishing the article to Strapi with the generated content and images
4. Enjoy your freshly exported article in Strapi!

## 🤝 Contributing

We welcome contributions from the community! If you have any ideas, suggestions, or bug reports, please open an issue or submit a pull request. Let's make Strapi Exporter even
better together!

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

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
- [x] Fix the process, it's not working at all, the content is not generated correctly (on full process)
- [x] Make it usable by anyone, env variables for Strapi URL, user & password & token
- [x] Config in the plugin settings for the schema to use
- [x] Config in the plugin settings for the fields to use
- [x] Clean Readme
- [x] Clean manifest
- [ ] Make it available as a plugin in Obsidian
- [ ] Add examples
- [ ] Add tests
- [ ] Renovate

- [ ] ajouter l'étape de création du plugin (création du folder)
- [ ] ajouter l'étape de redémarrage d'obsidian
- [ ] ajouter l'étape de configuration du plugin
  - [ ] ajouter l'étape de configuration du token d'access de strapi (accès etc)
---

🌟 Elevate your content workflow with Strapi Exporter and unleash the full potential of your Obsidian notes! 🌟