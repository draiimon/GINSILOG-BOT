const { Riffy, Player } = require("riffy");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionsBitField } = require("discord.js");
const { queueNames, requesters } = require("./commands/play");
const { Dynamic } = require("musicard");
const config = require("./config.js");
const musicIcons = require('./UI/icons/musicicons.js');
const colors = require('./UI/colors/colors');
const fs = require("fs");
const path = require("path");
const { autoplayCollection } = require('./mongodb.js');

async function sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2) {
    try {
        const permissions = channel.permissionsFor(channel.guild.members.me);
        if (!permissions.has(PermissionsBitField.Flags.SendMessages) ||
            !permissions.has(PermissionsBitField.Flags.EmbedLinks) ||
            !permissions.has(PermissionsBitField.Flags.AttachFiles) ||
            !permissions.has(PermissionsBitField.Flags.UseExternalEmojis)) {
            console.error("PUTANGINA MO GAGO! KULANG PERMISSION KO! BOBO KA BA?! HINDI AKO MAKAPAG SEND NG MESSAGE DAHIL SAYO!");
            return;
        }

        const message = await channel.send({
            embeds: [embed],
            files: [attachment],
            components: [actionRow1, actionRow2]
        });
        return message;
    } catch (error) {
        console.error("PUTANGINA NAG ERROR NANAMAN:", error.message);
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription("⚠️ **GAGO! DI MAKAPAG SEND NG MESSAGE! AYUSIN MO MUNA YANG PERMISSION KO BAGO KA MAGMAARTE! KINGINA MO!**");
        await channel.send({ embeds: [errorEmbed] });
    }
}

function initializePlayer(client) {
    const nodes = config.nodes.map(node => ({
        name: node.name,
        host: node.host,
        port: node.port,
        password: node.password,
        secure: node.secure,
        reconnectTimeout: 5000,
        reconnectTries: Infinity
    }));

    client.riffy = new Riffy(client, nodes, {
        send: (payload) => {
            const guildId = payload.d.guild_id;
            if (!guildId) return;

            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        defaultSearchPlatform: "ytmsearch",
        restVersion: "v4",
    });

    let currentTrackMessageId = null;
    let collector = null;

    client.riffy.on("nodeConnect", node => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}PUTANGINA! NODE ${node.name} CONNECTED NA GAGO! ✅${colors.reset}`);
    });
    
    client.riffy.on("nodeError", (node, error) => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}TANGINA! MAY ERROR SA NODE ${node.name} GAGO! ❌ | ${error.message}${colors.reset}`);
    });

    client.riffy.on("trackStart", async (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        const trackUri = track.info.uri;
        const requester = requesters.get(trackUri);

        try {
            const musicard = await Dynamic({
                thumbnailImage: track.info.thumbnail || 'https://example.com/default_thumbnail.png',
                backgroundColor: '#070707',
                progress: 10,
                progressColor: '#FF7A00',
                progressBarColor: '#5F2D00',
                name: track.info.title,
                nameColor: '#FF7A00',
                author: track.info.author || 'WALANG PANGALAN GAGO! BAKA INDIE!',
                authorColor: '#696969',
            });

            // Save the generated card to a file
            const cardPath = path.join(__dirname, 'musicard.png');
            fs.writeFileSync(cardPath, musicard);

            // Prepare the attachment and embed
            const attachment = new AttachmentBuilder(cardPath, { name: 'musicard.png' });
            const embed = new EmbedBuilder()
            .setAuthor({ 
                name: 'PUTANGINA! PINAPATUGTOG KO NA YANG KANTA MO GAGO!', 
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setFooter({ text: `GAWA NG PINAKA ASTIG NA BOT SA BUONG UNIVERSE! WAG KANG MAGHANAP NG IBA GAGO! | v1.2`, iconURL: musicIcons.heartIcon })
            .setTimestamp()
            .setDescription(  
                `**PUTA! PAKINGGAN MO TO GAGO, NAPAKAGANDA!**\n\n` +
                `👑 **TITLE:** [${track.info.title}](${track.info.uri})\n` +
                `🎤 **ARTIST:** ${track.info.author || 'WALANG PANGALAN! BAKA INDIE GAGO!'}\n` +
                `⏱️ **TAGAL:** ${formatDuration(track.info.length)}\n` +
                `🎵 **HINILING NG GAGONG TO:** ${requester}\n` +
                `🎧 **SOURCE:** ${track.info.sourceName}\n` + 
                `**COMMANDS PARA SA MGA BOBONG KATULAD MO:**\n` +
                `🔁 \`Ulitin\` | ❌ \`Wag na\` | ⏭️ \`Skip\` | 📜 \`Queue\` | 🗑️ \`Clear\`\n` +
                `⏹️ \`Stop\` | ⏸️ \`Pause\` | ▶️ \`Play\` | 🔊 \`Lakasan\` | 🔉 \`Hinaan\`\n\n` +
                `**PUTANGINA ANG GANDA NG TASTE MO SA MUSIC GAGO! SHEEEESH! 🔥**`)
            .setImage('attachment://musicard.png')
            .setColor('#FF7A00');

            const actionRow1 = createActionRow1(false);
            const actionRow2 = createActionRow2(false);

            const message = await sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2);
            if (message) {
                currentTrackMessageId = message.id;

                if (collector) collector.stop(); 
                collector = setupCollector(client, player, channel, message);
            }

        } catch (error) {
            console.error("PUTANGINA! ERROR SA PAGCREATE NG MUSIC CARD:", error.message);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription("⚠️ **KINGINA! DI MAGAWA YUNG CARD! PERO TULOY PA RIN TAYO SA PAGPAPATUGTOG GAGO!**");
            await channel.send({ embeds: [errorEmbed] });
        }
    });

    client.riffy.on("trackEnd", async (player) => {
        await disableTrackMessage(client, player);
        currentTrackMessageId = null;
    });

    client.riffy.on("playerDisconnect", async (player) => {
        await disableTrackMessage(client, player);
        currentTrackMessageId = null;
    });

    client.riffy.on("queueEnd", async (player) => {
        const channel = client.channels.cache.get(player.textChannel);
        const guildId = player.guildId;
    
        try {
            const autoplaySetting = await autoplayCollection.findOne({ guildId });
    
            if (autoplaySetting?.autoplay) {
                const nextTrack = await player.autoplay(player);
    
                if (!nextTrack) {
                    player.destroy();
                    await channel.send("⚠️ **PUTANGINA WALA NA AKONG MAKITANG KANTA! UMALIS NA LANG AKO GAGO!**");
                }
            } else {
                console.log(`WALANG AUTOPLAY SA GUILD ${guildId} GAGO!`);
                player.destroy();
                await channel.send("🎶 **UBOS NA YUNG QUEUE GAGO! MAGPATUGTOG KA ULIT KUNG GUSTO MO PA!**");
            }
        } catch (error) {
            console.error("PUTANGINA MAY ERROR SA AUTOPLAY:", error);
            player.destroy();
            await channel.send("👾 **TANGINA WALA NANG LAMAN YUNG QUEUE! AALIS NA KO GAGO!**");
        }
    });
    
    async function disableTrackMessage(client, player) {
        const channel = client.channels.cache.get(player.textChannel);
        if (!channel || !currentTrackMessageId) return;

        try {
            const message = await channel.messages.fetch(currentTrackMessageId);
            if (message) {
                const disabledRow1 = createActionRow1(true);
                const disabledRow2 = createActionRow2(true);
                await message.edit({ components: [disabledRow1, disabledRow2] });
            }
        } catch (error) {
            console.error("PUTANGINANG ERROR TO! DI MA-DISABLE YUNG MESSAGE:", error);
        }
    }
}

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    return [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        `${seconds}s`,
    ]
        .filter(Boolean)
        .join(' ');
}

function setupCollector(client, player, channel, message) {
    const filter = i => [
        'loopToggle', 'skipTrack', 'disableLoop', 'showQueue', 'clearQueue',
        'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown'
    ].includes(i.customId);

    const collector = message.createMessageComponentCollector({ filter, time: 600000 });

    collector.on('collect', async i => {
        await i.deferUpdate();

        const member = i.member;
        const voiceChannel = member.voice.channel;
        const playerChannel = player.voiceChannel;

        if (!voiceChannel || voiceChannel.id !== playerChannel) {
            const vcEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription('PUTANGINA MO! PUMASOK KA MUNA SA VOICE CHANNEL BAGO KA MAGMAARTE! BOBO KA BA?! 🤬');
            const sentMessage = await channel.send({ embeds: [vcEmbed] });
            setTimeout(() => sentMessage.delete().catch(console.error), config.embedTimeout * 1000);
            return;
        }

        handleInteraction(i, player, channel);
    });

    collector.on('end', () => {
        console.log("TANGINA TUMIGIL NA YUNG COLLECTOR! TINATAMAD NA KO MAGPATUGTOG!");
    });

    return collector;
}

async function handleInteraction(i, player, channel) {
    switch (i.customId) {
        case 'loopToggle':
            toggleLoop(player, channel);
            break;
        case 'skipTrack':
            player.stop();
            await sendEmbed(channel, "⏭️ **PUTANGINA! AYAW MO NA? SIGE SKIP NA YANG KANTA NA YAN! NEXT TAYO BOBO! CHOOSY KA PA KINGINA MO!**");
            break;
        case 'disableLoop':
            disableLoop(player, channel);
            break;
        case 'showQueue':
            showNowPlaying(channel, player);
            break;
        case 'clearQueue':
            player.queue.clear();
            await sendEmbed(channel, "🗑️ **TANGINA MO! BINURA KO NA LAHAT! WAG KANG MAGREKLAMO KINGINA MO! IKAW NAG SABI EH!**");
            break;
        case 'stopTrack':
            player.stop();
            player.destroy();
            await sendEmbed(channel, '⏹️ **AYAW MO NA TALAGA? SIGE TUMIGIL NA! UMALIS KA NA DITO GAGO! BYE TANGINA MO!**');
            break;
        case 'pauseTrack':
            if (player.paused) {
                await sendEmbed(channel, '⏸️ **BOBO KA BA?! NASA PAUSE NA NGA EH! GAMITIN MO MATA MO GAGO!**');
            } else {
                player.pause(true);
                await sendEmbed(channel, '⏸️ **OH TEKA LANG AH! NAKA-PAUSE MUNA! MAGPAHINGA KA MUNA GAGO! IHING IHI KA NA BA?!**');
            }
            break;
        case 'resumeTrack':
            if (!player.paused) {
                await sendEmbed(channel, '▶️ **PUTANGINA MO! TUMUTUGTOG NA NGA EH! BINGI KA BA O TANGA KA LANG TALAGA?!**');
            } else {
                player.pause(false);
                await sendEmbed(channel, '▶️ **SIGE NA! TULOY NA YANG KANTA! PARTY PARTY GAGO! WAG KANG TATANGA TANGA DYAN!**');
            }
            break;
        case 'volumeUp':
            adjustVolume(player, channel, 10);
            break;
        case 'volumeDown':
            adjustVolume(player, channel, -10);
            break;
    }
}

async function sendEmbed(channel, message) {
    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setDescription(message);
    const sentMessage = await channel.send({ embeds: [embed] });
    setTimeout(() => sentMessage.delete().catch(() => console.log('PUTANGINA DI MADELETE YUNG MESSAGE! HAYAAN MO NA YAN GAGO!')), config.embedTimeout * 1000);
}

function adjustVolume(player, channel, amount) {
    const newVolume = Math.min(100, Math.max(10, player.volume + amount));
    if (newVolume === player.volume) {
        sendEmbed(channel, amount > 0 ? 
            '🔊 **TANGINA MO TALAGA! NASA MAXIMUM NA NGA EH! BINGI KA NA BA GAGO?! GUSTO MO MASIRA TENGA MO?!**' : 
            '🔉 **GAGO KA BA?! NASA MINIMUM NA! ANO PA GUSTO MO? PABULONG?! TANGA KA BA?!**');
    } else {
        player.setVolume(newVolume);
        sendEmbed(channel, `🔊 **OH VOLUME ${newVolume}% NA GAGO! RINIG NA BA NG MGA KAPITBAHAY MO?! TANGINA MO TALAGA!**`);
    }
}

function toggleLoop(player, channel) {
    player.setLoop(player.loop === "track" ? "queue" : "track");
    sendEmbed(channel, player.loop === "track" ? 
        "🔁 **PAULIT ULIT NA YANG KANTA! WALA KA BANG IBANG ALAM?! PURO KA PAREHAS KINGINA MO!**" : 
        "🔁 **UULITIN KO LAHAT NG NASA QUEUE! DAMI MONG ARTE GAGO! MAGDAGDAG KA NA LANG NG KANTA!**");
}

function disableLoop(player, channel) {
    player.setLoop("none");
    sendEmbed(channel, "❌ **AYAW MO NA PAULIT ULIT? SIGE! WAG NA NGA! IKAW BAHALA SA BUHAY MO GAGO!**");
}

function showNowPlaying(channel, player) {
    if (!player || !player.current || !player.current.info) {
        sendEmbed(channel, "🚫 **WALANG TUMUTUGTOG GAGO! MAGPATUGTOG KA MUNA BAGO KA MAGTANONG! BOBO KA BA?!**");
        return;
    }

    const track = player.current.info;
    sendEmbed(channel, `🎵 **KASALUKUYANG TUMUTUGTOG:** [${track.title}](${track.uri}) - ${track.author}\n**PUTA ANG GANDA NG KANTANG TO GAGO! NAPAKAGANDA! SHEEEESH! 🔥**`);
}

function createActionRow1(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("loopToggle")
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("ULIT-ULITIN GAGO!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("disableLoop")
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("WAG NA KINGINA!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("skipTrack")
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("NEXT KANTA BOBO!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("showQueue")
                .setEmoji('💎')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("LINEUP PRE! SOLID TO!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("clearQueue")
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("CLEAR LAHAT GAGO!")
                .setDisabled(disabled)
        );
}

function createActionRow2(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("stopTrack")
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger)
                .setLabel("TUMIGIL KA TANGINA!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("pauseTrack")
                .setEmoji('⏸️')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("TEKA LANG GAGO!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("resumeTrack")
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("TULOY NA KINGINA!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("volumeUp")
                .setEmoji('🔊')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("LAKASAN PA GAGO!")
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("volumeDown")
                .setEmoji('🔉')
                .setStyle(ButtonStyle.Secondary)
                .setLabel("HINAAN MO TANGA!")
                .setDisabled(disabled)
        );
}

module.exports = { initializePlayer };
