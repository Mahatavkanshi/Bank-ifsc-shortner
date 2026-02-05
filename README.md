# Bank IFSC/MICR Processing System

A comprehensive Node.js application for processing and matching bank IFSC and MICR codes with advanced fuzzy matching algorithms for bank name standardization.

## Features

- **File Processing**: Support for CSV, Excel (.xlsx, .xls), JSON, TXT, DAT, and .001 formats
- **IFSC/MICR Validation**: Automatic validation of IFSC (11 characters) and MICR (9 characters) codes
- **Comparison & Matching**: Compare input data against bank mapping files
- **Fuzzy Matching**: Advanced bank name matching using:
  - Levenshtein Distance
  - Jaro-Winkler Similarity
  - Token Sort Ratio
  - Token Set Ratio
  - Phonetic Matching (Soundex)
- **RESTful API**: Complete REST API for programmatic access
- **Web Interface**: User-friendly HTML interface for easy interaction
- **Batch Processing**: Process complete workflows in a single operation

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start the server:**
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

For CLI mode (original functionality):
```bash
npm run cli
```

The server will start on `http://localhost:3000`

## Usage

### Web Interface

1. Open your browser and navigate to `http://localhost:3000`
2. Choose between:
   - **Quick Start**: Upload both files and process all steps at once
   - **Step-by-Step**: Process each step individually for more control

### API Endpoints

#### Health Check
```
GET /api/health
```

#### Upload Input File
```
POST /api/upload/input
Content-Type: multipart/form-data
Body: { inputFile: <file> }
```

#### Upload Bank Mapping File
```
POST /api/upload/bank-mapping
Content-Type: multipart/form-data
Body: { bankMappingFile: <file> }
```

#### Compare IFSC & MICR
```
POST /api/compare
```

#### Apply Fuzzy Matching
```
POST /api/fuzzy-match
```

#### Process Complete Workflow
```
POST /api/process-all
Content-Type: multipart/form-data
Body: { 
  inputFile: <file>,
  bankMappingFile: <file>
}
```

#### List Generated Files
```
GET /api/files
```

#### Download File
```
GET /api/download/:filename
```

#### Cleanup Files
```
DELETE /api/cleanup
```

## File Formats

### Input File Format
CSV format with columns:
```
MICR,IFSC,BankName,MICR_Length,IFSC_Length
```

### Bank Mapping File Format
Tilde-separated values (~):
```
BankID~IFSC~MICR~BankName~...
```

## Output Files

The system generates multiple output files:

### Validation Results
- `valid_records.csv` - Records with valid IFSC (11 chars) and MICR (9 chars)
- `invalid_records.csv` - Records that failed validation

### Matching Results
- `ifsc_matched.csv` - Records with IFSC found in bank mapping
- `ifsc_unmatched.csv` - Records with IFSC not found
- `micr_matched.csv` - Records with MICR found in bank mapping
- `micr_unmatched.csv` - Records with MICR not found
- `ifsc_missing_micr_present.csv` - IFSC not found but MICR found
- `micr_missing_ifsc_present.csv` - MICR not found but IFSC found
- `ifsc_micr_both_unmatched.csv` - Both IFSC and MICR not found

### Fuzzy Matching Results
- `bank_names_corrected.csv` - Full details with bank name corrections
- `only_corrected_bank_names.csv` - Mapping of original to corrected names
- `exact_matches_report.csv` - Summary of grouped bank names
- `ifsc_matched_records.csv` - All matched records with corrections

## Architecture

### Server Components
- **Express.js** - Web server framework
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### Processing Pipeline
1. **File Upload & Validation** - Validate file format and structure
2. **Data Filtering** - Separate valid from invalid records
3. **IFSC/MICR Comparison** - Match against bank mapping data
4. **Sorting** - Organize results by IFSC code
5. **Fuzzy Matching** - Standardize bank names using multiple algorithms

### Fuzzy Matching Algorithm
The system uses a weighted combination of:
- Levenshtein Distance (25%)
- Jaro-Winkler Similarity (30%)
- Token Sort Ratio (20%)
- Token Set Ratio (15%)
- Phonetic Matching (10%)

Match categories:
- **STRONG_MATCH**: ≥85% similarity
- **POSSIBLE_MATCH**: 70-84% similarity
- **WEAK_MATCH**: 60-69% similarity
- **NO_MATCH**: <60% similarity

## Project Structure

```
Bank-ifsc-shortner/
├── server.js                    # Express server
├── main.js                      # CLI version
├── processing-functions.js      # Core processing logic
├── package.json                 # Dependencies
├── public/
│   └── index.html              # Web interface
├── uploads/                     # Uploaded files storage
└── README.md                    # Documentation
```

## API Response Examples

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "totalRecords": 1000,
    "correctRecords": 950,
    "incorrectRecords": 50
  }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Security Considerations

- File size limit: 50MB
- Allowed file types: CSV, XLSX, XLS, JSON, TXT, DAT, .001
- Files are stored in the `uploads/` directory
- Use the cleanup endpoint to remove processed files

## Performance

- Handles large datasets efficiently using streaming
- Memory-optimized processing for files of any size
- Parallel processing where possible

## Troubleshooting

### Port Already in Use
Change the port in server.js or set the PORT environment variable:
```bash
PORT=4000 npm start
```

### File Upload Errors
- Check file size (max 50MB)
- Verify file format is supported
- Ensure uploads directory has write permissions

### Processing Errors
- Verify input file format matches expected structure
- Check bank mapping file has correct delimiter (~)
- Review server logs for detailed error messages

## Development

### Run in Development Mode
```bash
npm run dev
```

### Run CLI Version
```bash
npm run cli
```

## License

ISC

## Support

For issues and questions, please check the logs or contact the development team.
