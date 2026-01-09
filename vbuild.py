# VBuild
import json
import sys

def main():
    if len(sys.argv) < 2:
        print("Error: No config file path provided")
        sys.exit(1)
    cfg_path = sys.argv[1]
    print(f"Reading config file: {cfg_path}")
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file {cfg_path} does not exist")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: {cfg_path} is not a valid JSON file")
        sys.exit(1)
    project = cfg['project']
    order = cfg['order']
    output = cfg['output']
    content = []
    total_files = len(order)
    print(f"Starting JS file concatenation, {total_files} files to process")
    for idx, path in enumerate(order, 1):
        file_path = f"{project}/{path}.js"
        print(f"[{idx}/{total_files}] Reading file: {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content.append(f.read())
        except FileNotFoundError:
            print(f"Error: File {file_path} not found, terminating concatenation")
            sys.exit(1)
    print(f"All files read successfully, writing to output file: {output}")
    combined_content = '\n'.join(content)
    with open(output, 'w', encoding='utf-8') as f:
        f.write(combined_content)
    total_size = len(combined_content) / 1024
    print(f"Concatenation completed! Output file size: {total_size:.2f} KB")

if __name__ == "__main__":
    main()