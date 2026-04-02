import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [err, setErr] = useState('');

    async function signIn() {
        setErr('');
        try {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
        } catch (e) {
        setErr(e?.message || 'Sign in failed');
        }
    }

    async function register() {
        setErr('');
        try {
        await createUserWithEmailAndPassword(auth, email.trim(), pass);
        } catch (e) {
        setErr(e?.message || 'Register failed');
        }
    }

    return (
        <View style={styles.wrap}>
        <Text style={styles.title}>ABC Security Hub</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
            style={styles.input}
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
            style={styles.input}
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            placeholder="••••••••"
        />

        {!!err && <Text style={styles.err}>{err}</Text>}

        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={signIn}>
            <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={register}>
            <Text style={styles.secondaryText}>Register</Text>
        </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: '#F6F7F9' },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 12, color: '#666', marginTop: 10, marginBottom: 6 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 10, padding: 12 },
    err: { color: '#b00020', marginTop: 10 },
    btn: { marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    primary: { backgroundColor: '#3EA0D1' },
    primaryText: { color: '#fff', fontWeight: '700' },
    secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7d7d7' },
    secondaryText: { color: '#222', fontWeight: '700' },
});
