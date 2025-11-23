import React, { useState, useMemo } from 'react';
import { UploadIcon, DatabaseIcon, FileSpreadsheetIcon, CopyIcon, CheckIcon } from './components/Icons';
import { parseExcelFile, getUniqueValues } from './utils/excelService';
import { ValueSelector } from './components/ValueSelector';
import { SqlOperator, ExcelData } from './types';

function App() {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<SqlOperator>(SqlOperator.IN);
  
  // Value states
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // UI States
  const [generatedSql, setGeneratedSql] = useState('');
  const [copied, setCopied] = useState(false);

  // Derived state: Unique values for the currently selected column
  const uniqueColumnValues = useMemo(() => {
    if (!excelData || !selectedColumn) return [];
    return getUniqueValues(excelData.rows, selectedColumn);
  }, [excelData, selectedColumn]);

  // Validatie of de generate knop actief mag zijn
  const canGenerate = useMemo(() => {
    if (!selectedColumn) return false;
    
    switch (selectedOperator) {
      case SqlOperator.IN:
      case SqlOperator.NOT_IN:
        return selectedValues.length > 0;
      case SqlOperator.BETWEEN:
        return rangeStart.trim() !== '' && rangeEnd.trim() !== '';
      case SqlOperator.IS_NULL:
      case SqlOperator.IS_NOT_NULL:
        return true;
      default:
        // Single value operators (=, <>, >, <, LIKE)
        return selectedValues.length > 0 && selectedValues[0].trim() !== '';
    }
  }, [selectedColumn, selectedOperator, selectedValues, rangeStart, rangeEnd]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setIsLoading(true);
    setError(null);
    setFile(uploadedFile);
    setGeneratedSql('');

    try {
      const data = await parseExcelFile(uploadedFile);
      setExcelData(data);
      // Reset selections
      setSelectedColumn('');
      setSelectedValues([]);
      setRangeStart('');
      setRangeEnd('');
    } catch (err: any) {
      setError(err.message || "Fout bij inlezen bestand.");
      setExcelData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedColumn(e.target.value);
    setSelectedValues([]); // Clear values when column changes
    setRangeStart('');
    setRangeEnd('');
    setGeneratedSql('');
    setError(null);
  };

  const generateSql = () => {
    setError(null);
    setIsGenerating(true);

    // Korte timeout om UI te laten updaten (loader tonen) voordat zwaar werk begint
    setTimeout(() => {
      try {
        if (!selectedColumn) throw new Error("Selecteer een kolom.");

        const col = `"${selectedColumn}"`; // ArcGIS uses quotes for identifiers
        let sql = '';

        const formatValue = (val: string) => {
          // Trim whitespace en escape single quotes voor veiligheid
          return `'${val.trim().replace(/'/g, "''")}'`;
        };

        switch (selectedOperator) {
          case SqlOperator.IN:
          case SqlOperator.NOT_IN:
            if (selectedValues.length === 0) {
              throw new Error("Selecteer ten minste één waarde.");
            }
            const inList = selectedValues.map(formatValue).join(', ');
            sql = `${col} ${selectedOperator} (${inList})`;
            break;

          case SqlOperator.BETWEEN:
            if (rangeStart.trim() === '' || rangeEnd.trim() === '') {
              throw new Error("Vul beide tussenwaarden in.");
            }
            const isNumStart = !isNaN(Number(rangeStart)) && rangeStart.trim() !== '';
            const isNumEnd = !isNaN(Number(rangeEnd)) && rangeEnd.trim() !== '';
            
            const startVal = isNumStart ? rangeStart.trim() : formatValue(rangeStart);
            const endVal = isNumEnd ? rangeEnd.trim() : formatValue(rangeEnd);
            
            sql = `${col} BETWEEN ${startVal} AND ${endVal}`;
            break;

          case SqlOperator.IS_NULL:
          case SqlOperator.IS_NOT_NULL:
            sql = `${col} ${selectedOperator}`;
            break;

          default:
            // Single value operators (=, <>, >, <, LIKE)
            const rawVal = selectedValues[0];
            if (!rawVal || rawVal.trim() === '') {
               throw new Error("Vul een waarde in.");
            }
            
            // Check voor LIKE: altijd als string behandelen
            if (selectedOperator === SqlOperator.LIKE) {
              sql = `${col} ${selectedOperator} ${formatValue(rawVal)}`;
            } else {
              // Check of het een nummer is (en niet leeg)
              const isNum = !isNaN(Number(rawVal)) && rawVal.trim() !== '';
              const formattedVal = isNum ? rawVal.trim() : formatValue(rawVal);
              sql = `${col} ${selectedOperator} ${formattedVal}`;
            }
            break;
        }

        setGeneratedSql(sql);
      } catch (err: any) {
        setError(err.message);
        setGeneratedSql('');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const copyToClipboard = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center animate-fade-in">
          <h1 className="text-3xl font-bold text-gisib-primary flex items-center justify-center gap-3">
            <span className="bg-gisib-primary text-white p-2 rounded-lg shadow-md">
                <DatabaseIcon />
            </span>
            GISIB SQL Converter
          </h1>
          <p className="mt-2 text-gray-600">
            Genereer ArcGIS-compatibele SQL queries direct vanuit Excel data.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 transition-all hover:shadow-2xl">
          
          {/* Step 1: Upload */}
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Stap 1: Upload Bestand
            </label>
            <div className="relative group">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
                ${file ? 'border-success bg-green-50' : 'border-gray-300 group-hover:border-gisib-primary group-hover:bg-blue-50'}
              `}>
                <div className="flex flex-col items-center justify-center gap-2">
                  {file ? (
                    <>
                      <div className="text-success"><FileSpreadsheetIcon /></div>
                      <span className="font-medium text-success">{file.name}</span>
                      <span className="text-xs text-gray-500">Klik om een ander bestand te kiezen</span>
                    </>
                  ) : (
                    <>
                      <div className="text-gray-400 group-hover:text-gisib-primary"><UploadIcon /></div>
                      <span className="font-medium text-gray-600 group-hover:text-gisib-primary">Klik of sleep een Excel bestand hierheen</span>
                      <span className="text-xs text-gray-400">Ondersteunt .xlsx, .xls, .csv</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {isLoading && <p className="text-center text-sm text-gisib-primary mt-3 animate-pulse">Bestand verwerken...</p>}
            {error && !excelData && <p className="text-center text-sm text-red-600 mt-3 font-medium bg-red-50 p-2 rounded">{error}</p>}
          </div>

          {/* Configurator Area - Only shown if data is loaded */}
          {excelData && (
            <div className="p-6 space-y-8 animate-slide-up">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Step 2: Column Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                    Stap 2: Kies Kolom
                  </label>
                  <div className="relative">
                    <select
                      value={selectedColumn}
                      onChange={handleColumnChange}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gisib-primary appearance-none cursor-pointer hover:border-gisib-primary transition-colors"
                    >
                      <option value="" disabled>-- Selecteer een kolom --</option>
                      {excelData.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                    </div>
                  </div>
                </div>

                {/* Step 3: Operator Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                    Stap 3: Kies Operator
                  </label>
                  <div className="relative">
                    <select
                      value={selectedOperator}
                      onChange={(e) => {
                          setSelectedOperator(e.target.value as SqlOperator);
                          setError(null);
                          setGeneratedSql('');
                      }}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gisib-primary appearance-none cursor-pointer hover:border-gisib-primary transition-colors"
                    >
                      {Object.values(SqlOperator).map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Value Selector */}
              {selectedColumn && (
                <div className="animate-fade-in border-t border-gray-100 pt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                    Stap 4: Configureer Waarden
                  </label>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
                    <ValueSelector
                      operator={selectedOperator}
                      uniqueValues={uniqueColumnValues}
                      selectedValues={selectedValues}
                      onSelectionChange={(vals) => {
                          setSelectedValues(vals);
                          setError(null);
                          setGeneratedSql('');
                      }}
                      rangeStart={rangeStart}
                      onRangeStartChange={(val) => {
                          setRangeStart(val);
                          setError(null);
                          setGeneratedSql('');
                      }}
                      rangeEnd={rangeEnd}
                      onRangeEndChange={(val) => {
                          setRangeEnd(val);
                          setError(null);
                          setGeneratedSql('');
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2 animate-shake">
                      <span className="font-bold">!</span> {error}
                  </div>
              )}

              {/* Action Button */}
              <button
                onClick={generateSql}
                disabled={!canGenerate || isGenerating}
                className={`
                  w-full py-3.5 px-4 rounded-lg font-bold text-white shadow-md transition-all transform flex items-center justify-center gap-2
                  ${(!canGenerate || isGenerating) 
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none' 
                    : 'bg-success hover:bg-green-600 hover:shadow-lg active:scale-[0.99]'}
                `}
              >
                {isGenerating ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Bezig met genereren...
                    </>
                ) : (
                    'Genereer Query'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Output Area */}
        {generatedSql && (
          <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 animate-slide-up transition-all">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-success rounded-full"></span>
                  Resultaat (SQL)
              </h3>
              <button
                onClick={copyToClipboard}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                  ${copied 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'}
                `}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Gekopieerd!' : 'Kopiëren naar klembord'}
              </button>
            </div>
            <div className="relative group">
                <div className="bg-gisib-dark text-gray-100 p-5 rounded-xl font-mono text-sm overflow-x-auto border border-gray-700 shadow-inner leading-relaxed">
                  {generatedSql}
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">ArcGIS SQL</span>
                </div>
            </div>
            <div className="mt-4 text-xs text-gray-400 text-center italic">
              Klaar voor gebruik in ArcGIS Pro "Select By Attributes"
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;