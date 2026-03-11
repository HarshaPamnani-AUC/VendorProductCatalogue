// Test the upload endpoint directly
const testData = {
  vendorName: "ET PERFUMES INC.",
  fileName: "test.xlsx",
  fileContent: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQABgAIAAAAIQD1Nz7YwEAAAEQAAABBAAAQUExD"
};

fetch('http://localhost:5000/api/move-data/move-upload-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
