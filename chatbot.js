const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const client = new Client();

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

// Estado dos chats
const chatStates = {};

// Dias da semana disponíveis
const availableDays = [
    { id: '1', name: 'Segunda-feira' },
    { id: '2', name: 'Terça-feira' },
    { id: '3', name: 'Quarta-feira' },
    { id: '4', name: 'Quinta-feira' },
    { id: '5', name: 'Sexta-feira' },
    { id: '6', name: 'Sábado' },
    { id: '7', name: 'Domingo' }
];

// Mapeamento de serviços e valores
const SERVICES = {
    '1': { 
        name: 'Cabelo e Barba', 
        options: {
            '1': { name: 'Cortes adultos', value: 58.00 },
            '2': { name: 'Cortes infantis', value: 45.00 },
            '3': { name: 'Barba express', value: 40.00 },
            '4': { name: 'Barba no vapor ozônio', value: 80.00 }
        }
    },
    '2': { 
        name: 'Combos', 
        options: {
            '1': { name: 'Cabelo e barba express', value: 85.00 },
            '2': { name: 'Cabelo e barba no ozônio', value: 115.00 }
        }
    },
    '3': { 
        name: 'Químicas e limpeza de pele', 
        options: {
            '1': { name: 'Luzes', value: 110.00 },
            '2': { name: 'Selantes', value: 85.00 },
            '3': { name: 'Progressiva', value: 95.00 },
            '4': { name: 'Coloração', value: 60.00 },
            '5': { name: 'Limpeza de pele', value: 85.00 }
        }
    }
};

// Formas de pagamento
const PAYMENT_METHODS = {
    '1': 'PIX',
    '2': 'Cartão',
    '3': 'Dinheiro'
};

// Função para carregar agendamentos existentes
function loadAppointments() {
    if (fs.existsSync('appointments.json')) {
        return JSON.parse(fs.readFileSync('appointments.json', 'utf8'));
    }
    return [];
}

// Função para salvar agendamentos
function saveAppointment(appointment) {
    const appointments = loadAppointments();
    appointments.push(appointment);
    fs.writeFileSync('appointments.json', JSON.stringify(appointments, null, 2));
}

// Função para obter a próxima data de um dia da semana
function getNextDateForDay(targetDayName) {
    const today = new Date();
    const currentDayIndex = today.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    const targetDayIndex = availableDays.find(day => day.name === targetDayName).id - 1; // ID começa em 1, ajustamos para 0-based
    let daysAhead = targetDayIndex - currentDayIndex;
    if (daysAhead < 0) daysAhead += 7; // Se o dia já passou nesta semana, pega a próxima ocorrência
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysAhead);
    return nextDate;
}

// Função para formatar data no estilo "dd/mm/aa"
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // +1 porque getMonth é 0-based
    const year = date.getFullYear().toString().slice(-2); // Últimos 2 dígitos do ano
    return `${day}/${month}/${year}`;
}

// Função para gerar horários disponíveis
const generateTimeSlots = (day) => {
    const appointments = loadAppointments();
    const bookedSlots = appointments
        .filter(appointment => appointment.day === day && appointment.status === 'pending')
        .map(appointment => appointment.time);

    const slots = [];
    const today = new Date();
    const isToday = getNextDateForDay(day).toDateString() === today.toDateString();
    const currentHour = today.getHours();
    const startHour = 8; // 08:00
    const endHour = day === 'Domingo' ? 14 : 22; // Domingo até 14:00, outros até 22:00

    for (let hour = startHour; hour <= endHour; hour++) {
        const time = `${hour.toString().padStart(2, '0')}:00`;
        const isPast = isToday && hour <= currentHour;
        if (!bookedSlots.includes(time) && !isPast) {
            const id = String.fromCharCode(97 + slots.length); // 'a' = 97, 'b' = 98, etc.
            slots.push({ id: id, time: time });
        }
    }
    return slots;
};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const name = contact.pushname ? contact.pushname.split(" ")[0] : 'Cliente';
    const from = msg.from;

    // Resposta inicial
    if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && from.endsWith('@c.us')) {
        await delay(2000);
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(from, `Olá! Bem-vindo à Barbearia Waldiney Oliveira, ${name}. Como posso ajudar você hoje?\n\n1 - Agendamento\n2 - Atendimento ao cliente`);
        chatStates[from] = { step: 'main_menu' };
    }

    // Fluxo de escolha
    else if (chatStates[from]) {
        const state = chatStates[from];

        // Menu principal
        if (state.step === 'main_menu') {
            if (msg.body === '1') {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, `Escolha o tipo de serviço:\n\n1 - Cabelo e Barba\n2 - Combos\n3 - Químicas e limpeza de pele`);
                chatStates[from] = { step: 'select_service' };
            } else if (msg.body === '2') {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, 'Para atendimento ao cliente, por favor, descreva sua dúvida ou solicitação!');
                chatStates[from] = { step: 'customer_service' };
            }
        }

        // Atendimento ao cliente
        else if (state.step === 'customer_service') {
            await delay(2000);
            await chat.sendStateTyping();
            await delay(2000);
            await client.sendMessage(from, 'Aguarde um momento, um atendente irá ajudar você em breve.');
            delete chatStates[from];
        }

        // Escolha do serviço
        else if (state.step === 'select_service') {
            const service = SERVICES[msg.body];
            if (service) {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                const optionsText = Object.entries(service.options)
                    .map(([id, opt]) => `${id} - ${opt.name} - R$${opt.value.toFixed(2)}`)
                    .join('\n');
                await client.sendMessage(from, `Escolha o ${service.name === 'Combos' ? 'combo' : 'serviço'}:\n\n${optionsText}`);
                chatStates[from] = { step: 'select_option', serviceCategory: service.name, options: service.options };
            }
        }

        // Escolha da opção do serviço
        else if (state.step === 'select_option') {
            const selectedOption = state.options[msg.body];
            if (selectedOption) {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                const daysText = availableDays.map(day => `${day.id} - ${day.name}`).join('\n');
                await client.sendMessage(from, `Escolha o dia para ${selectedOption.name}:\n\n${daysText}`);
                chatStates[from] = { 
                    step: 'select_day', 
                    service: selectedOption.name, 
                    value: selectedOption.value, 
                    serviceCategory: state.serviceCategory 
                };
            }
        }

        // Escolha do dia
        else if (state.step === 'select_day') {
            const selectedDay = availableDays.find(d => d.id === msg.body);
            if (selectedDay) {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                const timeSlots = generateTimeSlots(selectedDay.name);
                if (timeSlots.length === 0) {
                    await client.sendMessage(from, `Desculpe, não há horários disponíveis para ${selectedDay.name}. Escolha outro dia digitando o número correspondente:\n\n${availableDays.map(day => `${day.id} - ${day.name}`).join('\n')}`);
                } else {
                    const slotsText = timeSlots.map(slot => `${slot.id}) ${slot.time}`).join('\n');
                    await client.sendMessage(from, `Horários disponíveis para ${selectedDay.name}:\n\n${slotsText}`);
                    chatStates[from] = { 
                        step: 'select_slot', 
                        day: selectedDay.name, 
                        slots: timeSlots, 
                        service: state.service, 
                        value: state.value 
                    };
                }
            }
        }

        // Escolha do horário
        else if (state.step === 'select_slot') {
            const selectedSlot = state.slots.find(s => s.id === msg.body.toLowerCase());
            if (selectedSlot) {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, `Escolha a forma de pagamento:\n\n1 - PIX\n2 - Cartão\n3 - Dinheiro`);
                chatStates[from] = { 
                    step: 'select_payment', 
                    day: state.day, 
                    slot: selectedSlot.time, 
                    service: state.service, 
                    value: state.value 
                };
            }
        }

        // Escolha da forma de pagamento
        else if (state.step === 'select_payment') {
            const paymentMethod = PAYMENT_METHODS[msg.body];
            if (paymentMethod) {
                const selectedDate = getNextDateForDay(state.day);
                const formattedDate = formatDate(selectedDate);
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, `Deseja confirmar o agendamento para ${state.service} em ${formattedDate} ${state.day} às ${state.slot} com pagamento via ${paymentMethod}? Digite "Sim" ou "Não"`);
                chatStates[from] = { 
                    step: 'confirm', 
                    day: state.day, 
                    date: formattedDate, 
                    slot: state.slot, 
                    service: state.service, 
                    value: state.value, 
                    payment: paymentMethod 
                };
            }
        }

        // Confirmação
        else if (state.step === 'confirm') {
            if (msg.body.toLowerCase() === 'sim') {
                const { day, date, slot, service, value, payment } = state;
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, `Agendamento confirmado para ${service} em ${date} ${day} às ${slot} com pagamento via ${payment}! Obrigado por escolher a Barbearia Waldiney Oliveira.`);

                // Salvar agendamento
                saveAppointment({
                    client: name,
                    service: service,
                    day: day,
                    date: date,
                    time: slot,
                    value: value,
                    payment: payment,
                    status: 'pending'
                });

                delete chatStates[from];
            } else if (msg.body.toLowerCase() === 'não') {
                await delay(2000);
                await chat.sendStateTyping();
                await delay(2000);
                await client.sendMessage(from, 'Agendamento descartado. Se precisar de algo, é só chamar!');
                delete chatStates[from];
            }
        }
    }
});