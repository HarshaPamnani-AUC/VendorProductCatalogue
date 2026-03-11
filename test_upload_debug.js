const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    console.log('Testing upload process...');
    
    // Create form data
    const form = new FormData();
    form.append('vendorName', 'A');
    
    // Check if template file exists
    const templatePath = './public/templates/UploadFormat.xlsx';
    if (!fs.existsSync(templatePath)) {
      console.error('Template file not found:', templatePath);
      return;
    }
    
    const fileStream = fs.createReadStream(templatePath);
    form.append('file', fileStream, 'UploadFormat.xlsx');
    
    console.log('Sending request to http://localhost:5000/api/upload-products...');
    
    const response = await fetch('http://localhost:5000/api/upload-products', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    
    const text = await response.text();
    console.log('Response body:', text);
    
  } catch (error) {
    console.error('Upload test error:', error.message);
  }
}

testUpload();
