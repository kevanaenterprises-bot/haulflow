import { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

const CSV_TEMPLATES = [
  {
    name: 'Drivers',
    filename: 'haulflow_drivers_template.csv',
    description: 'Name, CDL Number, Phone, Email, License State',
  },
  {
    name: 'Trucks & Trailers',
    filename: 'haulflow_trucks_template.csv',
    description: 'Unit Number, VIN, Year, Make, Model, Type',
  },
  {
    name: 'Customers',
    filename: 'haulflow_customers_template.csv',
    description: 'Company Name, Contact, Email, Phone, Address',
  },
  {
    name: 'Loads History',
    filename: 'haulflow_loads_template.csv',
    description: 'Load #, Origin, Destination, Rate, Date, Status',
  },
];

export default function StepDataImport({ files, onFilesChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
      );
      onFilesChange([...files, ...droppedFiles]);
    },
    [files, onFilesChange]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      onFilesChange([...files, ...selected]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Import Your Data</h2>
        <p className="text-sm text-slate-400">
          Download CSV templates, fill them with your existing data, then drag and drop them below. This step is optional — you can always import later.
        </p>
      </div>

      {/* Templates */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Download Templates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CSV_TEMPLATES.map(template => (
            <button
              key={template.filename}
              type="button"
              onClick={() => {
                // UI-only: in production, this would point to actual CSV files
                const link = document.createElement('a');
                link.href = `/templates/${template.filename}`;
                link.download = template.filename;
                link.click();
              }}
              className="flex items-start gap-3 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:bg-slate-700/60 hover:border-brand-500/50 transition group text-left"
            >
              <div className="bg-brand-500/20 p-2 rounded-lg flex-shrink-0 group-hover:bg-brand-500/30 transition">
                <Download className="w-4 h-4 text-brand-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition">
                  {template.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{template.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Upload Filled Templates
        </h3>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-400 bg-brand-500/10'
              : 'border-slate-600 hover:border-slate-500 bg-slate-700/20 hover:bg-slate-700/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload
            className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-brand-400' : 'text-slate-500'}`}
          />
          <p className="text-sm font-medium text-slate-300">
            {isDragging ? 'Drop files here...' : 'Drag & drop CSV/XLSX files here'}
          </p>
          <p className="text-xs text-slate-500 mt-1">or click to browse</p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Uploaded Files ({files.length})
          </h3>
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between bg-slate-700/30 border border-slate-600/50 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 rounded hover:bg-slate-600 transition text-slate-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Notice */}
      <div className="flex items-start gap-3 bg-brand-500/10 border border-brand-500/20 rounded-lg px-4 py-3">
        <AlertCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-300/80">
          Your data will be validated before import. You'll be able to review and correct any issues before finalizing.
        </p>
      </div>
    </div>
  );
}
