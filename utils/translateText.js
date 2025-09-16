// utils/translateText.js
const translate = require("google-translate-api-x"); // Ensure correct package is installed

// Translation function
const translateText = async (text, fromLanguage = "en", toLanguage = "hi") => {
  try {
    // Translate text using the Google Translate API
    const translation = await translate.singleTranslate(text, {
      from: fromLanguage,
      to: toLanguage,
      rejectOnPartialFail: false, // Allow partial translations
    });

    if (!translation || !translation.text) {
      throw new Error("Translation result is missing text.");
    }

    return translation.text; // Return the translated text
  } catch (error) {
    console.error("Error in translateText function:", error.message || error);
    return text; // Return original text if translation fails
  }
};

module.exports = translateText;
