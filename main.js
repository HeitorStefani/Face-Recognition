//pegar todos os endereços do html
const video = document.querySelector("#video");
const registerButton = document.querySelector("#registerButton");
const accessButton = document.querySelector("#accessButton");
const messageDiv = document.querySelector("#message");
const canvas = document.querySelector("#overlayCanvas");
const canvasToggle = document.querySelector("#canvasToggle");

//lugar para salvar os rostos
let labeledFaceDescriptors = [];

// Função para salvar os descritores no localStorage
function saveDescriptorsToLocalStorage() {
    const serializedDescriptors = labeledFaceDescriptors.map(descriptor => ({
        label: descriptor.label,
        descriptors: descriptor.descriptors.map(d => Array.from(d))
    }));
    localStorage.setItem('faceDescriptors', JSON.stringify(serializedDescriptors));
}

// Função para carregar os descritores do localStorage
function loadDescriptorsFromLocalStorage() {
    const storedDescriptors = localStorage.getItem('faceDescriptors');
    if (storedDescriptors) {
        const parsedDescriptors = JSON.parse(storedDescriptors);
        labeledFaceDescriptors = parsedDescriptors.map(storedDescriptor =>
            //cria uma nova box com o nome do conhecido
            new faceapi.LabeledFaceDescriptors(
                storedDescriptor.label,
                storedDescriptor.descriptors.map(d => new Float32Array(d))
            )
        );
    }
}

loadDescriptorsFromLocalStorage();

async function startVideo() {
    try {
        //pega o video
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        //seta ele no objeto criado no html
        video.srcObject = stream;

        video.addEventListener('loadedmetadata', () => {
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);
        });

        video.addEventListener('play', () => {
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                if (detections.length > 0) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);

                    // Verifica se o canvas está configurado para ser exibido
                    if (canvasToggle.value === "show") {
                        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

                        faceapi.draw.drawDetections(canvas, resizedDetections);
                        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

                        if (labeledFaceDescriptors.length > 0) {
                            const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
                            const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

                            results.forEach((result, i) => {
                                const box = resizedDetections[i].detection.box;
                                const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
                                drawBox.draw(canvas);
                            });
                        }
                    }
                }
            }, 100);
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadModels() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        await faceapi.nets.ageGenderNet.loadFromUri('/models');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');

        startVideo();
    } catch (err) {
        console.error(err);
    }
}

loadModels();

async function registerFace(name) {
    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (detections) {
        const descriptors = [detections.descriptor];
        const labeledFaceDescriptor = new faceapi.LabeledFaceDescriptors(name, descriptors);
        labeledFaceDescriptors.push(labeledFaceDescriptor);
        saveDescriptorsToLocalStorage();
        messageDiv.innerText = `Rosto cadastrado para ${name}`;
        messageDiv.style.color = "#28a745";
    } else {
        messageDiv.innerText = "Nenhum rosto detectado para cadastrar.";
        messageDiv.style.color = "#dc3545";
    }
}

async function accessPlatform() {
    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (detections && labeledFaceDescriptors.length > 0) {
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
        const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
        if (bestMatch.label !== "unknown") {
            messageDiv.innerText = `Bem-vindo, ${bestMatch.label}!`;
            messageDiv.style.color = "#28a745";
        } else {
            messageDiv.innerText = "Acesso negado. Por favor, abra a boca para confirmar que você é real.";
            messageDiv.style.color = "#dc3545";
        }
    } else {
        messageDiv.innerText = "Nenhum rosto detectado para acesso.";
        messageDiv.style.color = "#dc3545";
    }
}

registerButton.addEventListener('click', () => {
    const name = prompt("Insira o nome do usuário:");
    if (name) {
        registerFace(name);
    }
});

accessButton.addEventListener('click', () => {
    accessPlatform();
});

// Evento para alternar a visibilidade do canvas com base na seleção do usuário
canvasToggle.addEventListener('change', () => {
    if (canvasToggle.value === "show") {
        canvas.style.display = "block";
    } else {
        canvas.style.display = "none";
    }
});
