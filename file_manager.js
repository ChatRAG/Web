const API_BASE_URL = "https://ffztifxfc7.execute-api.ap-southeast-2.amazonaws.com/production";
let credentials = JSON.parse(localStorage.getItem("credentials")) || null;

document.addEventListener("DOMContentLoaded", async () => {
    loadFileList();
    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.add("collapsed");
    }
});

// Generate new credentials
async function generateCredentials(password) {
    const response = await fetch(`${API_BASE_URL}/gen_credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password }),
    });

    const data = await response.json();
    credentials = {
        AccessKeyId: data.AccessKeyId,
        SecretKey: data.SecretKey,
        SessionToken: data.SessionToken,
        Expiration: data.Expiration,
    };

    localStorage.setItem("credentials", JSON.stringify(credentials));
}

// Load the file list
async function loadFileList() {
    const response = await fetch(`${API_BASE_URL}/get_doc_list`);
    const data = await response.json();
    const files = data.documents;

    const fileList = document.getElementById("fileList");
    fileList.innerHTML = ""; // Clear existing files

    files.forEach(file => {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        
        // Create a hyperlink element
        const fileLink = document.createElement("a");
        fileLink.href = "#"; // Placeholder href, we will overwrite onclick
        fileLink.innerText = file.name;

        // Overwrite the onclick event for the hyperlink to open the file URL
        fileLink.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default link behavior
            openFileUrl(file.key);
        });

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.innerText = "Delete";
        deleteButton.onclick = () => deleteFile(file.key);

        // Append the link and delete button to the fileItem
        fileItem.appendChild(fileLink);
        fileItem.appendChild(deleteButton);

        // Add the fileItem to the file list
        fileList.appendChild(fileItem);
    });
}


// Delete file
async function deleteFile(fileKey) {
    await checkAndGenerateCredentials();
    if (confirm("Are you sure you want to delete this file?")) {
        const response = await fetch(`${API_BASE_URL}/delete_doc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                FileKey: fileKey,
                AccessKeyId: credentials.AccessKeyId,
                SecretKey: credentials.SecretKey,
                SessionToken: credentials.SessionToken,
            }),
        });

        if (response.ok) {
            alert("File deleted successfully.");
            loadFileList();
        } else {
            alert(`Failed to delete file. (HTTP ${response.status})`);
        }
    }
}

// Upload file
document.getElementById("uploadButton").addEventListener("click", async () => {
    await checkAndGenerateCredentials();
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "*/*";
    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const fileData = await readFileAsBase64(file);
            const response = await fetch(`${API_BASE_URL}/upload_doc`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    FileName: file.name,
                    FileData: {
                        "base64_data": fileData
                    },
                    AccessKeyId: credentials.AccessKeyId,
                    SecretKey: credentials.SecretKey,
                    SessionToken: credentials.SessionToken,
                }),
            });

            if (response.ok) {
                alert("File uploaded successfully.");
                loadFileList();
            } else if (response.status == 409) {
                alert("File already exists.");
            } else {
                alert(`Failed to upload file. (HTTP ${response.status})`);
            }
        }
    };
    fileInput.click();
});

document.getElementById('collapseButton').addEventListener('click', function () {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');

    // Optional: Change the arrow direction if you're not rotating it with CSS
    // this.textContent = sidebar.classList.contains('collapsed') ? '>' : '<';
});

// Helper function to convert file to base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Extract base64 data
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// Open the file URL in a new page
async function openFileUrl(fileKey) {
    try {
        const response = await fetch(`${API_BASE_URL}/get_doc_url?FileKey=${fileKey}`, {
            method: "GET",
        });

        if (response.ok) {
            const data = await response.json();
            const fileUrl = data.file_url;
            window.open(fileUrl, "_blank");
        } else {
            alert(`Failed to retrieve file URL. (HTTP ${response.status})`);
        }
    } catch (error) {
        console.error("Error fetching file URL:", error);
        alert("Failed to fetch file URL.");
    }
}

// Check and regenerate credentials if expired or missing
async function checkAndGenerateCredentials() {
    console.log(credentials)
    if (!credentials || 
        !credentials.AccessKeyId || 
        !credentials.SecretKey || 
        !credentials.SessionToken ||
         isCredentialsExpired(credentials)) {
        await showPasswordDialog();
    }
}

// Show password input dialog as an alert-style popup
function showPasswordDialog() {
    return new Promise((resolve, reject) => {
        const password = prompt("Please enter your password");

        if (password) {
            generateCredentials(password)
                .then(() => {
                    resolve();
                })
                .catch((err) => {
                    reject(err);
                });
        } else {
            reject("Password is required.");
        }
    });
}

// Check if the credentials have expired
function isCredentialsExpired(credentials) {
    const expirationDate = new Date(credentials.Expiration);
    return expirationDate < new Date();
}
