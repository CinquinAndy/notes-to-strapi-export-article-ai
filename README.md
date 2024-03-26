# 🚀 Strapi Exporter: Supercharge Your Obsidian-to-Strapi Workflow

[![Version](https://img.shields.io/github/package-json/v/CinquinAndy/notes-to-strapi-export-article-ai)](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/releases)
[![License](https://img.shields.io/github/license/CinquinAndy/notes-to-strapi-export-article-ai)](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/blob/main/LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-CinquinAndy-purple)](https://github.com/sponsors/CinquinAndy)

Strapi Exporter is a game-changing Obsidian plugin that streamlines your content creation process by seamlessly exporting your notes to Strapi CMS. With its AI-powered image handling and SEO optimization features, you can take your content to the next level with just a few clicks.

## ✨ Features

- 🖼️ Automatically upload images from your notes to Strapi
- 🎨 Generate SEO-friendly alt text and captions for images using AI
- 📝 Create SEO-optimized article content based on your notes
- 🔧 Customize the JSON template for the article fields in Strapi
- ⚙️ Easy configuration for Strapi API URL, token, and content attribute name

## 🛠️ Installation

### For users:

1. Download the latest release from the [releases page](https://github.com/CinquinAndy/notes-to-strapi-export-article-ai/releases/tag/)
2. Extract the downloaded ZIP file
3. Move the `main.js` file & `manifest.json` to your Obsidian plugins folder (usually located at `<vault>/.obsidian/plugins/`).
4. Restart Obsidian
5. Enable the plugin in Obsidian's settings under "Community plugins".
6. Configure the necessary settings (see the Configuration section below).
7. Enjoy!

### For developers:

To install Strapi Exporter, follow these steps (coming soon to the Obsidian plugin marketplace):

1. Clone this repository into your Obsidian plugins folder (usually located at `<vault>/.obsidian/plugins/`).
2. Run `npm install` to install the dependencies
3. Run `npm run build` to build the plugin
4. Restart Obsidian
5. Enable the plugin in Obsidian's settings under "Community plugins".
6. Configure the necessary settings (see the Configuration section below).

## ⚙️ Configuration

To get started with Strapi Exporter, you'll need to configure the following settings:

- **Strapi URL**: The URL of your Strapi instance (e.g., `https://your-strapi-url`).
- **Strapi API Token**: Your Strapi API token for authentication. You can create an API token in your Strapi admin panel under "Settings" > "API Tokens".
- **OpenAI API Key**: Your OpenAI API key for using GPT-3 to generate SEO-friendly content. You can get your API key from the [OpenAI website](https://platform.openai.com/account/api-keys).
- **JSON Template**: The JSON template for the article fields in Strapi. Customize this according to your Strapi content type structure. You can find the JSON template in your Strapi API documentation (Swagger).

  ⚠️ **Important:** Remove the `content` field from the JSON template and specify it separately in the "Strapi Content Attribute Name" setting.

- **JSON Template Description**: A description for each field in the JSON template to help GPT-3 understand the structure. Follow the same schema as the JSON template to provide descriptions for each field.
- **Strapi Article Create URL**: The URL to create articles in Strapi (e.g., `https://your-strapi-url/api/articles`).
- **Strapi Content Attribute Name**: The attribute name for the content field in Strapi (e.g., `content`).

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

We welcome contributions from the community! If you have any ideas, suggestions, or bug reports, please open an issue or submit a pull request. Let's make Strapi Exporter even better together!

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

🌟 Elevate your content workflow with Strapi Exporter and unleash the full potential of your Obsidian notes! 🌟

### Roadmap

- [ ] Make it available as a plugin in Obsidian
- [ ] Add examples
- [ ] Add tests
- [ ] Renovate

- [ ] ajouter l'étape de création du plugin (création du folder)
- [ ] ajouter l'étape de redémarrage d'obsidian
- [ ] ajouter l'étape de configuration du plugin
  - [ ] ajouter l'étape de configuration du token d'access de strapi (accès etc)

