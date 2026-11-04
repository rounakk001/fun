import docx

doc = docx.Document(r"C:\Users\rouna\Downloads\Yeonix-main\Yeonix_ML_Recommendation_Engine_Report.docx")
print("Total paragraphs:", len(doc.paragraphs))
print("Total tables:", len(doc.tables))
breaks = 0
for p in doc.paragraphs:
    for r in p.runs:
        if "w:type=\"page\"" in r._r.xml:
            breaks += 1
print(f"Total explicit page breaks: {breaks}")
print(f"Total sections / pages estimated: {breaks + 1}")
