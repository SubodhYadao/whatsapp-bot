// const express = require('express');
// const axios = require('axios');
// const { vCard } = require('vcard-generator');
// const { ImageAnnotatorClient } = require('@google-cloud/vision');
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// require('dotenv').config();

// const app = express();
// app.use(express.json());

// const port = process.env.PORT || 3000;
// const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
// const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
// const verifyToken = process.env.VERIFY_TOKEN;
// const googleApiKey = process.env.GOOGLE_API_KEY;

// // ** New Code for Google Cloud Vision Authentication **
// // This handles both local and Vercel environments
// const gcpCredentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
// let visionClient;

// if (gcpCredentialsJson) {
//   // On Vercel, the environment variable contains the JSON string
//   visionClient = new ImageAnnotatorClient({ credentials: JSON.parse(gcpCredentialsJson) });
// } else {
//   // Locally, the environment variable points to the file
//   visionClient = new ImageAnnotatorClient();
// }

// const genAI = new GoogleGenerativeAI(googleApiKey);

// // WhatsApp Webhook Verification
// app.get('/webhook', (req, res) => {
//     const mode = req.query['hub.mode'];
//     const token = req.query['hub.verify_token'];
//     const challenge = req.query['hub.challenge'];

//     if (mode === 'subscribe' && token === verifyToken) {
//         console.log('Webhook Verified!');
//         res.status(200).send(challenge);
//     } else {
//         res.sendStatus(403);
//     }
// });

// // WhatsApp Webhook to Receive Messages
// app.post('/webhook', async (req, res) => {
//     const body = req.body;

//     // Check if the webhook request is a valid message
//     if (body.object && body.entry && body.entry[0].changes[0].value.messages) {
//         const message = body.entry[0].changes[0].value.messages[0];

//         // Process only image messages
//         if (message.type === 'image') {
//             const senderId = message.from;
//             const mediaId = message.image.id;

//             try {
//                 // 1. Get temporary image URL from WhatsApp API
//                 const mediaResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
//                     headers: { 'Authorization': `Bearer ${whatsappAccessToken}` }
//                 });
//                 const mediaUrl = mediaResponse.data.url;

//                 // 2. Stream image and send to Google Cloud Vision
//                 const imageResponse = await axios.get(mediaUrl, {
//                     responseType: 'arraybuffer',
//                     headers: { 'Authorization': `Bearer ${whatsappAccessToken}` }
//                 });
//                 const imageBuffer = Buffer.from(imageResponse.data);

//                 const [result] = await visionClient.textDetection({
//                     image: { content: imageBuffer },
//                 });
//                 const fullText = result.fullTextAnnotation.text;
                
//                 // 3. Send raw text to Gemini API for structured data extraction
//                 const model = genAI.getGenerativeModel({ model: "gemini-pro" });
//                 const prompt = `Extract the contact information from the following text and return a JSON object with keys: 'firstName', 'lastName', 'phoneNumber', 'email', 'company', 'title', 'street', 'city', 'state', 'zipCode'. If a value is not found, use an empty string. The raw text is: ${fullText}`;

//                 const geminiResult = await model.generateContent(prompt);
//                 const geminiResponse = await geminiResult.response;
//                 const jsonText = geminiResponse.text.match(/```json\n([\s\S]*)\n```/)[1];
//                 const contactData = JSON.parse(jsonText);
                
//                 // 4. Generate a vCard (.vcf) file
//                 const vcard = new vCard();
//                 vcard.name.first = contactData.firstName || '';
//                 vcard.name.last = contactData.lastName || '';
//                 vcard.organization.value = contactData.company || '';
//                 vcard.title.value = contactData.title || '';
//                 vcard.tel.value = contactData.phoneNumber || '';
//                 vcard.email.value = contactData.email || '';
//                 vcard.address.value = {
//                     street: contactData.street || '',
//                     city: contactData.city || '',
//                     state: contactData.state || '',
//                     zipCode: contactData.zipCode || '',
//                 };
                
//                 // 5. Send the vCard back to the user
//                 await axios({
//                     method: 'POST',
//                     url: `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`,
//                     headers: { 'Authorization': `Bearer ${whatsappAccessToken}` },
//                     data: {
//                         messaging_product: 'whatsapp',
//                         to: senderId,
//                         type: 'contacts',
//                         contacts: [{
//                             name: { formatted_name: `${contactData.firstName} ${contactData.lastName}` },
//                             phones: [{ phone: contactData.phoneNumber }]
//                         }]
//                     }
//                 });

//                 res.status(200).send('Message processed successfully');

//             } catch (error) {
//                 console.error('Error processing message:', error.response ? error.response.data : error.message);
//                 res.sendStatus(500);
//             }
//         }
//     } else {
//         res.sendStatus(400);
//     }
// });

// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
const express = require('express');
const axios = require('axios');
const vCard = require('vcards-js'); // ✅ Using stable vCards package
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const verifyToken = process.env.VERIFY_TOKEN;
const googleApiKey = process.env.GOOGLE_API_KEY;

// ** Google Cloud Vision Authentication **
const gcpCredentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let visionClient;

if (gcpCredentialsJson) {
  visionClient = new ImageAnnotatorClient({
    credentials: JSON.parse(gcpCredentialsJson),
  });
} else {
  visionClient = new ImageAnnotatorClient();
}

const genAI = new GoogleGenerativeAI(googleApiKey);

// WhatsApp Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook Verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp Webhook to Receive Messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object && body.entry && body.entry[0].changes[0].value.messages) {
    const message = body.entry[0].changes[0].value.messages[0];

    if (message.type === 'image') {
      const senderId = message.from;
      const mediaId = message.image.id;

      try {
        // 1. Get temporary image URL from WhatsApp API
        const mediaResponse = await axios.get(
          `https://graph.facebook.com/v19.0/${mediaId}`,
          {
            headers: { Authorization: `Bearer ${whatsappAccessToken}` },
          }
        );
        const mediaUrl = mediaResponse.data.url;

        // 2. Download image and send to Google Cloud Vision
        const imageResponse = await axios.get(mediaUrl, {
          responseType: 'arraybuffer',
          headers: { Authorization: `Bearer ${whatsappAccessToken}` },
        });
        const imageBuffer = Buffer.from(imageResponse.data);

        const [result] = await visionClient.textDetection({
          image: { content: imageBuffer },
        });
        const fullText = result.fullTextAnnotation?.text || '';

        // 3. Send raw text to Gemini API
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const prompt = `Extract the contact information from the following text and return a JSON object with keys: 'firstName', 'lastName', 'phoneNumber', 'email', 'company', 'title', 'street', 'city', 'state', 'zipCode'. If a value is not found, use an empty string. The raw text is: ${fullText}`;

        const geminiResult = await model.generateContent(prompt);
        const geminiResponse = await geminiResult.response;
        const rawText = geminiResponse.text();

        // Parse JSON safely
        let jsonText;
        try {
          const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
          jsonText = match ? match[1] : rawText;
        } catch {
          jsonText = rawText;
        }

        let contactData = {};
        try {
          contactData = JSON.parse(jsonText);
        } catch (err) {
          console.error('Failed to parse Gemini response as JSON:', rawText);
          contactData = {
            firstName: '',
            lastName: '',
            phoneNumber: '',
            email: '',
            company: '',
            title: '',
            street: '',
            city: '',
            state: '',
            zipCode: '',
          };
        }

        // 4. Generate a vCard (.vcf) file
        const vcard = vCard();
        vcard.firstName = contactData.firstName || '';
        vcard.lastName = contactData.lastName || '';
        vcard.organization = contactData.company || '';
        vcard.title = contactData.title || '';
        vcard.workPhone = contactData.phoneNumber || '';
        vcard.email = contactData.email || '';
        vcard.workAddress = {
          street: contactData.street || '',
          city: contactData.city || '',
          stateProvince: contactData.state || '',
          postalCode: contactData.zipCode || '',
        };

        // (OPTION A) Send as WhatsApp Contact object
        await axios({
          method: 'POST',
          url: `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`,
          headers: { Authorization: `Bearer ${whatsappAccessToken}` },
          data: {
            messaging_product: 'whatsapp',
            to: senderId,
            type: 'contacts',
            contacts: [
              {
                name: {
                  formatted_name: `${contactData.firstName} ${contactData.lastName}`,
                  first_name: contactData.firstName,
                  last_name: contactData.lastName,
                },
                phones: [{ phone: contactData.phoneNumber }],
                emails: [{ email: contactData.email }],
                org: { company: contactData.company, title: contactData.title },
              },
            ],
          },
        });

        // (OPTION B) To send actual .vcf file → Upload file to WhatsApp first, then send
        // const fs = require('fs');
        // const filePath = '/tmp/contact.vcf';
        // fs.writeFileSync(filePath, vcard.getFormattedString());

        res.status(200).send('Message processed successfully');
      } catch (error) {
        console.error(
          'Error processing message:',
          error.response ? error.response.data : error.message
        );
        res.sendStatus(500);
      }
    }
  } else {
    res.sendStatus(400);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
