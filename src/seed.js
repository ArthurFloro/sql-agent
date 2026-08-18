// Prescisamos gerar um arquivo access.log fake (para simular os acessos ao sistema)
import { createWriteStream, statSync } from "node:fs"
import { faker } from "@faker-js/faker"
import { LOG_FILE, LOG_INTERVAL } from "./constants.js"

const maxRecords = Number(process.argv[2] || Infinity)

if (
    (!Number.isInteger(maxRecords) && Number.isFinite(maxRecords))
    || Number.isNaN(maxRecords)
    || maxRecords <= 0
) {
    console.error("Uso: npm run seed -- <quantidade>")
    console.error("A quantidade deve ser um número inteiro maior que zero")
    process.exit(1)
}

const stream = createWriteStream(LOG_FILE)

function generateUser() {
    return {
        ip: faker.internet.ip(),
        username: faker.internet.userName(),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        email: faker.internet.email(),
        location: faker.address.city(),
        job_area: faker.name.jobArea(),
        company: faker.company.name(),
        job_title: faker.name.jobTitle(),
    }
}

function generateLogEntry(user) {
    return {
        ...user,
        id: faker.string.uuid(),
        timestamp: faker.date.recent().toISOString(),
    }
}

function writeRecord(line) {
    return new Promise((resolve) => {
        if (!stream.write(line)) {
            stream.once("drain", resolve)
        } else {
            resolve()
        }
    })
}

function convertFromBytesToGB(bytes) {
    return (bytes / 1024 / 1024 / 1024).toFixed(4)
}

console.log(`Gerando logs de acesso falsos em ${LOG_FILE}... (Ctrl+C para parar)`)
console.log(`Limite de registros: ${maxRecords.toLocaleString()}`)

const users = Array.from({ length: 5 }, generateUser)

process.on("SIGINT", () => {
    stream.end(() => {
        const { size } = statSync(LOG_FILE)
        console.log(`Geração interrompida. Registros: ${count.toLocaleString()} | Tamanho do arquivo: ${convertFromBytesToGB(size)} GB`)
    })
})

let count = 0
while (count < maxRecords) {
    const user = faker.helpers.arrayElement(users)
    const record = generateLogEntry(user)

    await writeRecord(JSON.stringify(record) + "\n")
    count++

    if (count % LOG_INTERVAL === 0) {
        const { size } = statSync(LOG_FILE)
        console.log(`Registros gerados: ${count.toLocaleString()} | Tamanho do arquivo: ${convertFromBytesToGB(size)} GB`)
    }
}

stream.end(() => {
    const { size } = statSync(LOG_FILE)
    console.log(`Geração concluída. Registros: ${count.toLocaleString()} | Tamanho do arquivo: ${convertFromBytesToGB(size)} GB`)
})